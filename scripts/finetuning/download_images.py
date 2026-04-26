import os
import quilt3 as q3

def download_single_cell_images():
    """
    Fetches the directories containing the 2D single-cell crops 
    by browsing the Quilt Package Manifest with the exact folder keys.
    """
    local_img_dir_1 = "./allen_cell_data/images_fish_1"
    local_img_dir_2 = "./allen_cell_data/images_fish_2"
    
    # Create directories
    os.makedirs(local_img_dir_1, exist_ok=True)
    os.makedirs(local_img_dir_2, exist_ok=True)

    print("Connecting to Allen Cell Quilt Package Manifest...")
    pkg = q3.Package.browse("aics/integrated_transcriptomics_structural_organization_hipsc_cm", "s3://allencell")

    # Fetch FISH 1 single-cell crops using the corrected key
    print("Downloading FISH 1 single-cell crops (this will take a while)...")
    pkg["2d_autocontrasted_fields_and_single_cells_fish_1"]["rescaled_2D_single_cell_tiff_path"].fetch(local_img_dir_1)

    # Fetch FISH 2 single-cell crops (assuming the same naming convention)
    print("Downloading FISH 2 single-cell crops...")
    pkg["2d_autocontrasted_fields_and_single_cells_fish_2"]["rescaled_2D_single_cell_tiff_path"].fetch(local_img_dir_2)
    
    print("All single-cell images downloaded locally!")

if __name__ == "__main__":
    download_single_cell_images()