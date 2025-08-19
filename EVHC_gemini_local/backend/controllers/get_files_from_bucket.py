from google.cloud import storage
import os
from fastapi import HTTPException
# Initialize the GCS client
project_id = os.environ.get("PROJECT_ID")
bucket_id = os.environ.get("BUCKET_ID")
table_id = os.environ.get("BIGQUERY_TABLE_ID")
bucket_folder = os.environ.get("BUCKET_FOLDER")

storage_client = storage.Client()



def get_all_files():
    try:
        # Access the specified GCS bucket
        bucket = storage_client.get_bucket(bucket_id)
        # List all blobs (files) in the bucket
        blobs = bucket.list_blobs()
        # Generate list of file names and public URLs for files in the specified folder
        file_urls = []
        for blob in blobs:
            # Check if the blob is in the specified folder and has the correct extensions
            if blob.name.startswith(f"{bucket_folder}/") and (
                    blob.name.endswith(".mp4") or blob.name.endswith(".webm")):
                # Construct the public URL
                public_url = f"https://storage.cloud.google.com/{bucket_id}/{blob.name}"
                # Append the formatted output with just the file name and public URL
                file_urls.append({
                    "file_name": os.path.basename(blob.name),  # Get only the file name
                    "public_url": public_url
                })

        return file_urls

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))