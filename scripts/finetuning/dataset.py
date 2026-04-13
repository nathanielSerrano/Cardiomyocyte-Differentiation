import os
import glob
import pandas as pd
import torch
from torch.utils.data import Dataset
import tifffile as tiff
import numpy as np

class CardiomyocyteDataset(Dataset):
    def __init__(self, metadata_csv, img_dir_1, img_dir_2, target_channel_idx=1, transform=None):
        """
        Args:
            metadata_csv (string): Path to the combined_metadata.csv
            img_dir_1 (string): Path to images_fish_1 directory
            img_dir_2 (string): Path to images_fish_2 directory
            target_channel_idx (int): The index of the alpha-actinin-2 channel (0-9)
            transform (callable, optional): PyTorch transforms to apply to the images
        """
        self.metadata = pd.read_csv(metadata_csv)
        self.target_channel_idx = target_channel_idx
        self.transform = transform
        
        # We need to drop any rows that might be missing our target score
        self.metadata = self.metadata.dropna(subset=['Prob_Organized_ZDisks'])
        
        # 1. Map all local files in both directories
        print("Indexing image files, please wait...")
        all_files = glob.glob(os.path.join(img_dir_1, "*.tiff")) + \
                    glob.glob(os.path.join(img_dir_2, "*.tiff"))
        
        # 2. Build a quick lookup dictionary: (fov_hash, cell_num) -> file_path
        self.file_map = {}
        for f in all_files:
            filename = os.path.basename(f)
            parts = filename.split('_')
            fov_hash = parts[1]
            # Extract the cell number (e.g., 'cell13.ome.tiff' -> '13')
            cell_num = filename.split('_cell')[-1].split('.ome')[0]
            self.file_map[(fov_hash, cell_num)] = f

        # 3. Filter the dataframe to only include rows where we successfully downloaded the image
        valid_indices = []
        self.valid_filepaths = []
        
        for idx, row in self.metadata.iterrows():
            # Extract FOV hash from result_image_path (e.g., "result_image_path/c0d70f15_fov_0.tif")
            fov_hash = str(row['result_image_path']).split('/')[1].split('_')[0]
            
            # Extract cell number from CellId (e.g., "fov-0-cell-1")
            cell_num = str(row['CellId']).split('-')[-1]
            
            match_key = (fov_hash, cell_num)
            if match_key in self.file_map:
                valid_indices.append(idx)
                self.valid_filepaths.append(self.file_map[match_key])
                
        self.metadata = self.metadata.loc[valid_indices].reset_index(drop=True)
        print(f"Successfully linked {len(self.metadata)} image files to labels!")

    def __len__(self):
        return len(self.metadata)

    def __getitem__(self, idx):
        # 1. Get image path and load the 10-channel image array
        img_path = self.valid_filepaths[idx]
        image_array = tiff.imread(img_path)
        
        # 2. Extract ONLY the target structure channel (e.g., Alpha-actinin-2)
        # image_array shape is (10, H, W). We isolate the specific index.
        single_channel_array = image_array[self.target_channel_idx].astype(np.float32)
        
        # 3. Convert to 3-channel (RGB) format to match ResNet-18 pre-trained expectations
        # This duplicates the grayscale structural data across the RGB channels -> Shape: (H, W, 3)
        rgb_image_array = np.stack((single_channel_array,) * 3, axis=-1)
        
        # 4. Apply PyTorch transforms (resize, normalize, convert to tensor)
        if self.transform:
            image = self.transform(rgb_image_array)
        else:
            # Fallback tensor conversion: move channels to PyTorch's expected (C, H, W) format
            image = torch.tensor(rgb_image_array).permute(2, 0, 1)
            
        # 5. Get the regression target
        label = self.metadata.iloc[idx]['Prob_Organized_ZDisks']
        target = torch.tensor(label, dtype=torch.float32)
        
        return image, target