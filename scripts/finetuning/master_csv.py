import os
import quilt3 as q3
import pandas as pd

def build_final_master_dataset():
    print("Connecting to Quilt Package...")
    pkg = q3.Package.browse("aics/integrated_transcriptomics_structural_organization_hipsc_cm", "s3://allencell")
    
    # 1. Download both image manifests
    print("Downloading image manifests...")
    manifest_1_path = "./allen_cell_data/image_manifest_fish_1.csv"
    manifest_2_path = "./allen_cell_data/image_manifest_fish_2.csv"
    
    pkg["2d_autocontrasted_fields_and_single_cells_fish_1"]["metadata.csv"].fetch(manifest_1_path)
    pkg["2d_autocontrasted_fields_and_single_cells_fish_2"]["metadata.csv"].fetch(manifest_2_path)
    
    manifest_1 = pd.read_csv(manifest_1_path)
    manifest_2 = pd.read_csv(manifest_2_path)
    combined_manifest = pd.concat([manifest_1, manifest_2], ignore_index=True)
    
    # 2. Load our previously combined structural scores
    print("Loading structural metadata...")
    struct_df = pd.read_csv("./allen_cell_data/combined_metadata.csv")
    struct_df = struct_df.dropna(subset=['Prob_Organized_ZDisks'])
    
    # 3. Extract the integer cell number from 'CellId' (e.g., 'fov-0-cell-1' -> 1)
    struct_df['cell_label_value'] = struct_df['CellId'].apply(lambda x: int(str(x).split('-')[-1]))
    
    # 4. MERGE the dataframes on the FOV and the cell number
    print("Merging datasets based on biological keys...")
    final_df = pd.merge(
        struct_df, 
        combined_manifest, 
        on=['original_fov_location', 'cell_label_value'], 
        how='inner'
    )
    
    # 5. Extract just the raw filename from the manifest path
    # 'rescaled_2D_single_cell_tiff_path/d39d...cell1.ome.tiff' -> 'd39d...cell1.ome.tiff'
    final_df['image_filename'] = final_df['rescaled_2D_single_cell_tiff_path'].apply(lambda x: str(x).split('/')[-1])
    
    # 6. Save the final file!
    final_path = "./allen_cell_data/final_training_metadata.csv"
    final_df.to_csv(final_path, index=False)
    
    print(f"\nSUCCESS! Created master dataset with {len(final_df)} perfectly linked cells.")
    print(f"Saved to: {final_path}")
    print("\nPreview of the final linkage:")
    print(final_df[['CellId', 'Prob_Organized_ZDisks', 'image_filename', 'source_batch']].head())

if __name__ == "__main__":
    build_final_master_dataset()