from google.cloud import storage, bigquery
import os
import logging
from fastapi import HTTPException

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

project_id = os.environ.get("PROJECT_ID")
bucket_id = os.environ.get("BUCKET_ID")
table_id = os.environ.get("BIGQUERY_TABLE_ID")
bucket_folder = os.environ.get("BUCKET_FOLDER")

bigquery_client = bigquery.Client()



def get_video_file_data(filename):

    try:
        logging.info(f"Received filename: {filename}")

        query = f"""
        SELECT * FROM `{project_id}.{table_id}` 
        WHERE filename = @filename
        """

        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("filename", "STRING", filename),
            ]
        )

        query_job = bigquery_client.query(query, job_config=job_config)
        results = query_job.result()

        records = [dict(row) for row in results]
        logging.info(f"Records fetched: {records}")

        if not records:
            raise HTTPException(status_code=404, detail="No records found for the given filename")

        summary_list = [record.pop('summary') for record in records if 'summary' in record]

        return {"records": records, "summary": summary_list}

    except Exception as e:
        logging.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))