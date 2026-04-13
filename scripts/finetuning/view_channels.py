import tifffile as tiff
import matplotlib.pyplot as plt

# Point this to any one of the downloaded images
img_path = "./allen_cell_data/images_fish_1/00223660_a2cc22be_5500000013_63X_20190807_S2_P6_C3_annotations_corrected_rescaled_cell13.ome.tiff"
image_array = tiff.imread(img_path)

# The shape should be (10, H, W)
num_channels = image_array.shape[0]

fig, axes = plt.subplots(2, 5, figsize=(15, 6))
for i, ax in enumerate(axes.flat):
    if i < num_channels:
        ax.imshow(image_array[i], cmap='gray')
        ax.set_title(f"Channel {i}")
    ax.axis('off')
    
plt.tight_layout()
plt.show()