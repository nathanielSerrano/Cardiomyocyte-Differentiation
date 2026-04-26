import os
import quilt3 as q3
import pandas as pd

def download_and_combine_metadata():
    """
    Fetches both FISH batch metadata files from the Allen Institute Quilt bucket,
    loads them into DataFrames, and concatenates them into a single ground-truth file.
    """
    # 1. Ensure a local data directory exists
    local_data_dir = "./allen_cell_data"
    os.makedirs(local_data_dir, exist_ok=True)

    # Define the local file paths
    fish_1_path = os.path.join(local_data_dir, "metadata_fish_1.csv")
    fish_2_path = os.path.join(local_data_dir, "metadata_fish_2.csv")
    combined_path = os.path.join(local_data_dir, "combined_metadata.csv")

    # 2. Connect to the Quilt bucket
    print("Connecting to Allen Cell S3 Bucket...")
    b = q3.Bucket("s3://allencell")

    # 3. Download the files
    print("Downloading FISH 1 metadata...")
    b.fetch(
        "aics/integrated_transcriptomics_structural_organization_hipsc_cm/automated_local_and_global_structure_fish_1/metadata.csv", 
        fish_1_path
    )

    print("Downloading FISH 2 metadata...")
    b.fetch(
        "aics/integrated_transcriptomics_structural_organization_hipsc_cm/automated_local_and_global_structure_fish_2/metadata.csv", 
        fish_2_path
    )

    # 4. Load into Pandas DataFrames
    print("Loading into DataFrames...")
    df_fish_1 = pd.read_csv(fish_1_path)
    df_fish_2 = pd.read_csv(fish_2_path)

    # 5. Add a batch tracking column before combining (Optional but highly recommended)
    # This allows you to track if one batch performs suspiciously worse during model evaluation
    df_fish_1['source_batch'] = 'fish_1'
    df_fish_2['source_batch'] = 'fish_2'

    # 6. Concatenate the dataframes
    combined_df = pd.concat([df_fish_1, df_fish_2], ignore_index=True)
    
    # 7. Save the master CSV
    combined_df.to_csv(combined_path, index=False)
    
    print(f"Success! Combined dataset created with {len(combined_df)} total cells.")
    print(f"Master metadata saved to: {combined_path}")
    
    return combined_df

# Execute the pipeline
if __name__ == "__main__":
    master_dataframe = download_and_combine_metadata()
    
    # Preview the specific columns you need for the model
    target_columns = ['CellId', 'result_image_path', 'Prob_Organized_ZDisks', 'source_batch']
    print("\nPreview of model training targets:")
    print(master_dataframe[target_columns].head())