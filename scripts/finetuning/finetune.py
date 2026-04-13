"""
The script for fine-tuning the ResNet model will go here.
"""
import os
import glob
import time
import copy
import torch
import torch.nn as nn
import torch.optim as optim
import pandas as pd
import numpy as np
import tifffile as tiff
from torch.utils.data import Dataset, DataLoader, random_split
from torchvision import models, transforms
import torch.nn.functional as F
import torchvision.transforms.functional as TF
import tqdm

import torch
import torch.nn as nn

class AsymmetricBCELoss(nn.Module):
    """
    Custom Loss Function to heavily penalize False Negatives.
    """
    def __init__(self, false_negative_penalty=5.0):
        super(AsymmetricBCELoss, self).__init__()
        # 5.0 means missing a mature cell is punished 5x harder than missing an immature one
        self.fn_penalty = false_negative_penalty 

    def forward(self, predictions, targets):
        # Clamp predictions slightly to prevent log(0) from exploding to mathematical infinity
        predictions = torch.clamp(predictions, min=1e-7, max=1-1e-7)
        
        # The Custom BCE Math:
        # The left side (targets * log) only activates for Ground Truth = 1 (Mature Cells)
        # We multiply ONLY this side by our massive penalty weight
        loss = - (self.fn_penalty * targets * torch.log(predictions) + (1.0 - targets) * torch.log(1.0 - predictions))
        
        return torch.mean(loss)

# ---------------------------------------------------------
# 1. Dataset Class (Updated for Single-Directory Loading)
# ---------------------------------------------------------
class CardiomyocyteDataset(Dataset):
    def __init__(self, metadata_csv, img_dir, target_channel_idx=1, transform=None):
        # Load the newly merged master file
        self.metadata = pd.read_csv(metadata_csv)
        self.img_dir = img_dir
        self.target_channel_idx = target_channel_idx
        self.transform = transform
        
        # Filter the metadata so it ONLY contains rows corresponding to the passed img_dir
        # (This allows us to cleanly split FISH 1 and FISH 2)
        if "fish_1" in img_dir:
            self.metadata = self.metadata[self.metadata['source_batch'] == 'fish_1']
        elif "fish_2" in img_dir:
            self.metadata = self.metadata[self.metadata['source_batch'] == 'fish_2']
            
        self.metadata = self.metadata.reset_index(drop=True)
        print(f"Loaded {len(self.metadata)} cells for directory: {img_dir}")

    def __len__(self):
        return len(self.metadata)

    def __getitem__(self, idx):
        filename = self.metadata.iloc[idx]['image_filename']
        img_path = os.path.join(self.img_dir, filename)
        
        image_array = tiff.imread(img_path)
        single_channel = image_array[self.target_channel_idx].astype(np.float32)
        rgb_image = np.stack((single_channel,) * 3, axis=-1)
        
        # 1. Convert to Tensor (Channels, Height, Width)
        image_tensor = torch.tensor(rgb_image).permute(2, 0, 1)
        
        # --- NEW: ASPECT RATIO PRESERVING RESIZE ---
        _, h, w = image_tensor.shape
        max_dim = max(h, w)
        scale = 224.0 / max_dim
        new_h = int(h * scale)
        new_w = int(w * scale)
        
        # Resize proportionately
        image_tensor = TF.resize(image_tensor, [new_h, new_w], antialias=True)
        
        # Pad with black pixels to make it exactly 224x224
        pad_top = (224 - new_h) // 2
        pad_bottom = 224 - new_h - pad_top
        pad_left = (224 - new_w) // 2
        pad_right = 224 - new_w - pad_left
        
        # F.pad format is (left, right, top, bottom)
        image_tensor = F.pad(image_tensor, (pad_left, pad_right, pad_top, pad_bottom), value=0)
        # -------------------------------------------

        # 3. Apply the rest of the augmentations (flips, rotations, normalization)
        if self.transform:
            image = self.transform(image_tensor)
        else:
            image = image_tensor
            
        label = self.metadata.iloc[idx]['Prob_Organized_ZDisks']
        target = torch.tensor(label, dtype=torch.float32)
        
        return image, target


# ---------------------------------------------------------
# 2. Main Training Pipeline
# ---------------------------------------------------------
def train_model():
    batch_size = 32
    num_epochs = 40
    learning_rate = 1e-4
    
    if torch.cuda.is_available():
        device = torch.device("cuda")
    elif torch.backends.mps.is_available():
        device = torch.device("mps")
    else:
        device = torch.device("cpu")
    print(f"\nTraining on device: {device}")

    data_transforms = transforms.Compose([
    transforms.RandomHorizontalFlip(p=0.5),
    transforms.RandomVerticalFlip(p=0.5),
    transforms.RandomRotation(180), # Forces it to learn the texture at any angle
    transforms.Resize((224, 224), antialias=True),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

    # --- Load FISH 1 for Training/Validation ---
    print("\n--- Preparing FISH 1 (Train/Val) ---")
    fish_1_dataset = CardiomyocyteDataset(
        metadata_csv="./allen_cell_data/final_training_metadata.csv",
        img_dir="./allen_cell_data/images_fish_1",
        target_channel_idx=1,
        transform=data_transforms
    )

    # 85% Train, 15% Val split on FISH 1
    train_size = int(0.85 * len(fish_1_dataset))
    val_size = len(fish_1_dataset) - train_size
    train_dataset, val_dataset = random_split(fish_1_dataset, [train_size, val_size])

    # --- Load FISH 2 for Testing ---
    print("\n--- Preparing FISH 2 (Strict Held-Out Test) ---")
    test_dataset = CardiomyocyteDataset(
        metadata_csv="./allen_cell_data/final_training_metadata.csv",
        img_dir="./allen_cell_data/images_fish_2",
        target_channel_idx=1,
        transform=data_transforms
    )

    from torch.utils.data import WeightedRandomSampler
    import numpy as np

    # 1. Extract all the labels from the training set
    train_labels = [train_dataset.dataset.metadata.iloc[i]['Prob_Organized_ZDisks'] for i in train_dataset.indices]
    train_labels = np.array(train_labels)

    # 2. Define our classes based on your FastAPI threshold
    # 0 = Failure (< 0.40), 1 = Success (>= 0.40)
    class_labels = (train_labels >= 0.40).astype(int)
    
    # 3. Count how many of each we have
    class_counts = np.bincount(class_labels)
    
    # 4. Calculate the inverse frequency weight for each class
    # (If there are very few successes, their weight becomes massive)
    class_weights = 1.0 / class_counts
    
    # 5. Assign the correct weight to every single image in the training set
    sample_weights = np.array([class_weights[label] for label in class_labels])
    sample_weights = torch.from_numpy(sample_weights).double()

    # 6. Create the PyTorch Sampler
    sampler = WeightedRandomSampler(weights=sample_weights, num_samples=len(sample_weights), replacement=True)

    dataloaders = {
        # Plug the sampler in here, remove shuffle=True
        'train': DataLoader(train_dataset, batch_size=batch_size, sampler=sampler, num_workers=4),
        
        # Validation and Test stay exactly the same
        'val': DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=4),
        'test': DataLoader(test_dataset, batch_size=batch_size, shuffle=False, num_workers=4)
    }
    dataset_sizes = {'train': len(train_dataset), 'val': len(val_dataset), 'test': len(test_dataset)}

    print("\nInitializing ResNet-18...")
    model = models.resnet18(weights=models.ResNet18_Weights.IMAGENET1K_V1)
    
    num_ftrs = model.fc.in_features
    model.fc = nn.Sequential(
        nn.Linear(num_ftrs, 1),
        nn.Sigmoid() 
    )
    model = model.to(device)

    # criterion = nn.MSELoss() 
    criterion = AsymmetricBCELoss(false_negative_penalty=10.0)
    optimizer = optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=1e-4)

    # New: Reduce learning rate by a factor of 0.5 if Validation Loss plateaus for 3 epochs
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', factor=0.5, patience=3)

    since = time.time()
    best_model_wts = copy.deepcopy(model.state_dict())
    best_loss = float('inf')

    # --- Training Loop ---
    for epoch in tqdm.tqdm(range(num_epochs), desc="Fine-Tuning ResNet-18"):
        for phase in ['train', 'val']:
            if phase == 'train':
                model.train() 
            else:
                model.eval()   

            running_loss = 0.0

            for inputs, labels in dataloaders[phase]:
                inputs = inputs.to(device)
                labels = labels.to(device).view(-1, 1)

                optimizer.zero_grad()

                with torch.set_grad_enabled(phase == 'train'):
                    outputs = model(inputs)
                    loss = criterion(outputs, labels)

                    if phase == 'train':
                        loss.backward()
                        optimizer.step()

                running_loss += loss.item() * inputs.size(0)

            epoch_loss = running_loss / dataset_sizes[phase]
            # print(f'{phase.capitalize()} Loss: {epoch_loss:.4f}')
            print(f'Epoch {epoch+1}/{num_epochs} - {phase.capitalize()} Loss: {epoch_loss:.4f}')

            # Step the scheduler based on Validation Loss and print if it changes
            if phase == 'val':
                current_lr = optimizer.param_groups[0]['lr']
                scheduler.step(epoch_loss)
                new_lr = optimizer.param_groups[0]['lr']
                
                if new_lr < current_lr:
                    print(f" -> Learning rate automatically reduced to {new_lr}")

            if phase == 'val' and epoch_loss < best_loss:
                best_loss = epoch_loss
                best_model_wts = copy.deepcopy(model.state_dict())
                torch.save(model.state_dict(), 'best_cardiomyocyte_resnet18.pth')
                print(" -> Saved new best model!")

    time_elapsed = time.time() - since
    print(f'\nTraining complete in {time_elapsed // 60:.0f}m {time_elapsed % 60:.0f}s')
    print(f'Best Validation Loss: {best_loss:.4f}')

    # ---------------------------------------------------------
    # 3. Final Test Evaluation (On FISH 2)
    # ---------------------------------------------------------
    print("\n" + "="*45)
    print("Evaluating on Held-Out FISH 2 Test Set...")
    print("="*45)
    
    model.load_state_dict(best_model_wts)
    model.eval()
    
    test_loss = 0.0
    with torch.no_grad():
        for inputs, labels in dataloaders['test']:
            inputs = inputs.to(device)
            labels = labels.to(device).view(-1, 1)
            
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            test_loss += loss.item() * inputs.size(0)
            
    final_test_loss = test_loss / dataset_sizes['test']
    print(f"Final Test Mean Squared Error: {final_test_loss:.4f}")
    print("This metric accurately reflects real-world biological generalization.")

if __name__ == '__main__':
    train_model()