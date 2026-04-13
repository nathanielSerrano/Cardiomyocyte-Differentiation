import cv2
import torch
import numpy as np
import matplotlib.pyplot as plt

class ResNetGradCAM:
    """
    Hooks into the final convolutional layer of ResNet-18 to capture 
    feature maps and gradients during inference.
    """
    def __init__(self, model):
        self.model = model
        # For ResNet-18, the final conv block is layer4
        self.target_layer = model.layer4[-1] 
        self.gradients = None
        self.activations = None
        
        # Register PyTorch hooks to intercept data during the forward/backward passes
        self.target_layer.register_forward_hook(self.save_activation)
        self.target_layer.register_full_backward_hook(self.save_gradient)
        
    def save_activation(self, module, input, output):
        self.activations = output.detach()
        
    def save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()
        
    def __call__(self, input_tensor):
        # 1. Forward pass
        output = self.model(input_tensor)
        
        # 2. Backward pass (forces PyTorch to calculate gradients for the target layer)
        self.model.zero_grad()
        output.backward(retain_graph=True)
        
        # 3. Global average pooling of gradients to get feature weights
        weights = torch.mean(self.gradients, dim=[2, 3], keepdim=True)
        
        # 4. Multiply feature maps by their weights and sum them up
        cam = torch.sum(weights * self.activations, dim=1).squeeze()
        
        # 5. Apply ReLU (we only care about features that positively influenced the score)
        cam = torch.relu(cam)
        
        # 6. Normalize between 0 and 1
        cam_min, cam_max = cam.min(), cam.max()
        if cam_max > 0:
            cam = (cam - cam_min) / cam_max
            
        return cam.cpu().numpy(), output.item()


def generate_and_save_heatmap(cam_array, original_image_rgb, save_path):
    """
    Takes the raw CAM array, resizes it, applies a color map, 
    blends it with the original cell image, and saves it to disk.
    """
    # 1. Resize the 7x7 ResNet feature map back up to 224x224
    cam_resized = cv2.resize(cam_array, (224, 224))
    
    # 2. Convert to an 8-bit color map (JET is standard: Red=High attention, Blue=Low)
    heatmap = np.uint8(255 * cam_resized)
    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)
    
    # 3. Normalize the original image to 0-255 for blending
    original_img_uint8 = np.uint8(255 * (original_image_rgb / np.max(original_image_rgb)))
    original_img_resized = cv2.resize(original_img_uint8, (224, 224))
    
    # 4. Blend the heatmap over the original image (50% opacity each)
    superimposed_img = cv2.addWeighted(original_img_resized, 0.5, heatmap, 0.5, 0)
    
    # 5. Save the final visual to disk
    cv2.imwrite(save_path, superimposed_img)