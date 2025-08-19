import os
from fastapi import HTTPException, File, UploadFile
from google.cloud import storage, bigquery
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

project_id = os.environ.get("PROJECT_ID")
bucket_id = os.environ.get("BUCKET_ID")
table_id = os.environ.get("BIGQUERY_TABLE_ID")
bucket_folder = os.environ.get("BUCKET_FOLDER")

storage_client = storage.Client()
bigquery_client = bigquery.Client()



async def delete_from_gcs(filename: str):

    logger.info(f"Attempting to delete file '{filename}' from GCS...")
    try:
        bucket = storage_client.bucket(bucket_id)
        blob = bucket.blob(f"{bucket_folder}/{filename}")

        if not blob.exists():
            logger.warning(f"File '{filename}' not found in GCS.")
            raise HTTPException(status_code=404, detail=f"File '{filename}' not found in GCS.")

        blob.delete()
        logger.info(f"File '{filename}' successfully deleted from GCS.")
    except Exception as e:
        logger.error(f"GCS Deletion Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"GCS Deletion Error: {str(e)}")


async def delete_from_bigquery(filename: str):

    logger.info(f"Preparing to delete data for file '{filename}' from BigQuery...")
    try:
        delete_query = f"""
        DELETE FROM `{table_id}`
        WHERE filename = @filename
        """
        delete_job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("filename", "STRING", filename),
            ]
        )
        delete_query_job = bigquery_client.query(delete_query, job_config=delete_job_config)
        delete_query_job.result()  # Wait for job to complete
        logger.info(f"Data for file '{filename}' successfully deleted from BigQuery.")
    except Exception as e:
        logger.error(f"BigQuery Deletion Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"BigQuery Deletion Error: {str(e)}")