import logging
import vertexai
from vertexai.generative_models import GenerativeModel, Part, SafetySetting
import json
import os
from fastapi import HTTPException, File, UploadFile
from google.cloud import storage, bigquery
from dotenv import load_dotenv
import requests
import tempfile
import uuid
from urllib.parse import urlparse
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import urllib3

load_dotenv()
project_id = os.environ.get("PROJECT_ID")
bucket_id = os.environ.get("BUCKET_ID")
table_id = os.environ.get("BIGQUERY_TABLE_ID")
bucket_folder = os.environ.get("BUCKET_FOLDER")
car = os.environ.get("CAR")

# Setup Ford proxy configuration
def setup_ford_proxy():
    """Setup Ford corporate proxy settings for Google Cloud services - ONLY for development"""
    if os.getenv("ENVIRONMENT") == "production":
        logging.info("Production environment - skipping proxy configuration in Analyzing_video")
        return
    
    proxy_settings = {
        'http_proxy': "http://internet.ford.com:83",
        'https_proxy': "http://internet.ford.com:83",
        'HTTP_PROXY': "http://internet.ford.com:83",
        'HTTPS_PROXY': "http://internet.ford.com:83",
        'NO_PROXY': ".ford.com,localhost,127.0.0.1,19.*,.googleapis.com,.google.com,metadata.google.internal,169.254.169.254",
        'no_proxy': ".ford.com,localhost,127.0.0.1,19.*,.googleapis.com,.google.com,metadata.google.internal,169.254.169.254"
    }
    
    for key, value in proxy_settings.items():
        os.environ[key] = value
    
    # Set Google Cloud specific environment variables
    os.environ['GOOGLE_CLOUD_DISABLE_GRPC'] = 'true'  # Force HTTP instead of gRPC
    os.environ['GRPC_DNS_RESOLVER'] = 'native'
    
    logging.info("Ford proxy settings configured for Google Cloud services in development")

# Setup proxy at module load
setup_ford_proxy()

# Disable SSL warnings for corporate proxy (if needed)
# urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()
project_id = os.environ.get("PROJECT_ID")
bucket_id = os.environ.get("BUCKET_ID")
table_id = os.environ.get("BIGQUERY_TABLE_ID")
bucket_folder = os.environ.get("BUCKET_FOLDER")

# Global client variables for lazy initialization
_storage_client = None
_bigquery_client = None

def get_storage_client():
    """Get or create storage client with proper error handling"""
    global _storage_client
    if _storage_client is None:
        try:
            # Ensure proxy is set up
            setup_ford_proxy()
            
            # Check for explicit credentials
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if credentials_path and os.path.exists(credentials_path):
                from google.oauth2 import service_account
                credentials = service_account.Credentials.from_service_account_file(credentials_path)
                _storage_client = storage.Client(project=project_id, credentials=credentials)
                logger.info("Storage client initialized with service account credentials")
            else:
                _storage_client = storage.Client(project=project_id)
                logger.info("Storage client initialized with default credentials")
                
        except Exception as e:
            logger.error(f"Failed to initialize storage client: {e}")
            raise HTTPException(status_code=500, detail=f"Storage service unavailable: {str(e)}")
    return _storage_client

def get_bigquery_client():
    """Get or create BigQuery client with proper error handling"""
    global _bigquery_client
    if _bigquery_client is None:
        try:
            # Ensure proxy is set up
            setup_ford_proxy()
            
            # Check for explicit credentials
            credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')
            if credentials_path and os.path.exists(credentials_path):
                from google.oauth2 import service_account
                credentials = service_account.Credentials.from_service_account_file(credentials_path)
                _bigquery_client = bigquery.Client(project=project_id, credentials=credentials)
                logger.info("BigQuery client initialized with service account credentials")
            else:
                _bigquery_client = bigquery.Client(project=project_id)
                logger.info("BigQuery client initialized with default credentials")
                
        except Exception as e:
            logger.error(f"Failed to initialize BigQuery client: {e}")
            # Don't raise exception for BigQuery as it's not critical for main functionality
            return None
    return _bigquery_client

def get_proxy_session():
    """Create a requests session with Ford proxy configuration"""
    session = requests.Session()
    
    # Configure proxy for the session
    proxies = {
        'http': 'http://internet.ford.com:83',
        'https': 'http://internet.ford.com:83'
    }
    
    session.proxies.update(proxies)
    
    # Set timeout and retry configuration
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    
    # Updated for newer urllib3 versions
    retry_strategy = Retry(
        total=3,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],  # Changed from method_whitelist
        backoff_factor=1
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session

def download_video_from_url(video_url):
    """Download video from URL using Ford proxy and return a temporary file"""
    try:
        logger.info(f"Downloading video from URL: {video_url}")
        
        # Use proxy session
        session = get_proxy_session()
        
        # Get the video content with proper headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
            'Accept-Encoding': 'identity',
        }
        
        response = session.get(video_url, headers=headers, stream=True, timeout=120)
        response.raise_for_status()
        
        # Get file extension from URL or default to mp4
        parsed_url = urlparse(video_url)
        file_extension = os.path.splitext(parsed_url.path)[1] or '.mp4'
        
        # Create temporary file
        temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_extension)
        
        # Download in chunks
        total_size = 0
        max_size = 100 * 1024 * 1024  # 100MB limit
        
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                total_size += len(chunk)
                if total_size > max_size:
                    temp_file.close()
                    os.unlink(temp_file.name)
                    raise HTTPException(status_code=413, detail="Video file too large (>100MB)")
                temp_file.write(chunk)
        
        temp_file.close()
        logger.info(f"Video downloaded successfully. Size: {total_size} bytes")
        return temp_file.name, file_extension
    
    except Exception as e:
        logger.error(f"Error downloading video from URL: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to download video: {str(e)}")

def upload_downloaded_video_to_gcs(temp_file_path, file_extension):
    """Upload downloaded video to GCS"""
    try:
        # Generate unique filename
        unique_filename = f"direct_upload_{uuid.uuid4()}{file_extension}"
        
        # Use lazy-initialized client
        storage_client = get_storage_client()
        bucket = storage_client.get_bucket(bucket_id)
        blob_name = f"{bucket_folder}/{unique_filename}"
        blob = bucket.blob(blob_name)
        
        # Upload file
        with open(temp_file_path, 'rb') as file_data:
            blob.upload_from_file(file_data, content_type=f'video/{file_extension[1:]}')
        
        # Clean up temp file
        os.unlink(temp_file_path)
        
        gcs_url = f"gs://{bucket_id}/{blob.name}"
        public_url = f"https://storage.cloud.google.com/{bucket_id}/{blob.name}"
        
        logger.info(f"Video uploaded to GCS: {gcs_url}")
        return {"gcs_url": gcs_url, "file_public_url": public_url}
    
    except Exception as e:
        # Clean up temp file on error
        if os.path.exists(temp_file_path):
            os.unlink(temp_file_path)
        logger.error(f"Error uploading to GCS: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload video: {str(e)}")

def download_and_analyze_video(video_url, system_instructions):
    """Download video from URL, upload to GCS, and analyze"""
    try:
        logger.info(f"Starting download and analysis for video URL: {video_url}")
        
        # Download video
        temp_file_path, file_extension = download_video_from_url(video_url)
        
        # Upload to GCS
        upload_result = upload_downloaded_video_to_gcs(temp_file_path, file_extension)
        
        # Analyze the video
        result = analyzing_videos(
            upload_result["gcs_url"], 
            system_instructions, 
            upload_result["file_public_url"]
        )
        
        return result
    
    except Exception as e:
        logger.error(f"Error in download_and_analyze_video: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def insert_into_bigquery(data_to_insert):
    """Insert analysis results into BigQuery"""
    logger.info(f"Inserting data into BigQuery for filename: {data_to_insert.get('filename', 'unknown')}")
    logger.info(f"Final JSON response with video URL: {data_to_insert}")
    
    try:
        # Use lazy-initialized client
        bigquery_client = get_bigquery_client()
        if bigquery_client is None:
            logger.warning("BigQuery client not available, skipping insertion")
            return
            
        query = f"""
            INSERT INTO `{project_id}.{table_id}` 
            (filename, car_type, service_related_video, sound_and_image, show_license_plate,
             car_on_ramp, service_advisor_or_technician_name, DealershipName,
             special_tools_tyres, customer_name, special_tools_brake_pad,
             Special_tools_disc, attached_offer_mentioned, correct_ending,
             show_license_plate_eval, car_on_ramp_eval, service_advisor_or_technician_name_eval,
             DealershipName_eval, customer_name_eval, special_tools_tyres_eval,
             special_tools_brake_pad_eval, Special_tools_disc_eval,
             attached_offer_mentioned_eval, approve_offer_mentioned_eval, correct_ending_eval,
             total_points_eval, percentage, battery_checked_eval, wind_screen_checked_eval,
             summary, video_url)
            VALUES (@filename, @car_type, @service_related_video, @sound_and_image, @show_license_plate,
                    @car_on_ramp, @service_advisor_or_technician_name, @DealershipName,
                    @special_tools_tyres, @customer_name, @special_tools_brake_pad,
                    @Special_tools_disc, @attached_offer_mentioned, @correct_ending,
                    @show_license_plate_eval, @car_on_ramp_eval, @service_advisor_or_technician_name_eval,
                    @DealershipName_eval, @customer_name_eval, @special_tools_tyres_eval,
                    @special_tools_brake_pad_eval, @Special_tools_disc_eval,
                    @attached_offer_mentioned_eval, @approve_offer_mentioned_eval, @correct_ending_eval,
                    @total_points_eval, @percentage, @battery_checked_eval, @wind_screen_checked_eval,
                    @summary, @video_url)
        """

        # Define the job configuration with parameters
        job_config = bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ScalarQueryParameter("filename", "STRING", data_to_insert.get("filename", "")),
                bigquery.ScalarQueryParameter("car_type", "STRING", data_to_insert.get("car_type", "")),
                bigquery.ScalarQueryParameter("service_related_video", "STRING", data_to_insert.get("service_related_video", "")),
                bigquery.ScalarQueryParameter("sound_and_image", "STRING", data_to_insert.get("sound_and_image", "")),
                bigquery.ScalarQueryParameter("show_license_plate", "STRING", data_to_insert.get("show_license_plate", "")),
                bigquery.ScalarQueryParameter("car_on_ramp", "STRING", data_to_insert.get("car_on_ramp", "")),
                bigquery.ScalarQueryParameter("service_advisor_or_technician_name", "STRING", data_to_insert.get("service_advisor_or_technician_name", "")),
                bigquery.ScalarQueryParameter("DealershipName", "STRING", data_to_insert.get("DealershipName", "")),
                bigquery.ScalarQueryParameter("special_tools_tyres", "STRING", data_to_insert.get("special_tools_tyres", "")),
                bigquery.ScalarQueryParameter("customer_name", "STRING", data_to_insert.get("customer_name", "")),
                bigquery.ScalarQueryParameter("special_tools_brake_pad", "STRING", data_to_insert.get("special_tools_brake_pad", "")),
                bigquery.ScalarQueryParameter("Special_tools_disc", "STRING", data_to_insert.get("Special_tools_disc", "")),
                bigquery.ScalarQueryParameter("attached_offer_mentioned", "STRING", data_to_insert.get("attached_offer_mentioned", "")),
                bigquery.ScalarQueryParameter("correct_ending", "STRING", data_to_insert.get("correct_ending", "")),
                bigquery.ScalarQueryParameter("show_license_plate_eval", "STRING", data_to_insert.get("show_license_plate_eval", "")),
                bigquery.ScalarQueryParameter("car_on_ramp_eval", "STRING", data_to_insert.get("car_on_ramp_eval", "")),
                bigquery.ScalarQueryParameter("service_advisor_or_technician_name_eval", "STRING", data_to_insert.get("service_advisor_or_technician_name_eval", "")),
                bigquery.ScalarQueryParameter("DealershipName_eval", "STRING", data_to_insert.get("DealershipName_eval", "")),
                bigquery.ScalarQueryParameter("customer_name_eval", "STRING", data_to_insert.get("customer_name_eval", "")),
                bigquery.ScalarQueryParameter("special_tools_tyres_eval", "STRING", data_to_insert.get("special_tools_tyres_eval", "")),
                bigquery.ScalarQueryParameter("special_tools_brake_pad_eval", "STRING", data_to_insert.get("special_tools_brake_pad_eval", "")),
                bigquery.ScalarQueryParameter("Special_tools_disc_eval", "STRING", data_to_insert.get("Special_tools_disc_eval", "")),
                bigquery.ScalarQueryParameter("attached_offer_mentioned_eval", "STRING", data_to_insert.get("attached_offer_mentioned_eval", "")),
                bigquery.ScalarQueryParameter("approve_offer_mentioned_eval", "STRING", data_to_insert.get("approve_offer_mentioned_eval", "")),
                bigquery.ScalarQueryParameter("correct_ending_eval", "STRING", data_to_insert.get("correct_ending_eval", "")),
                bigquery.ScalarQueryParameter("total_points_eval", "STRING", data_to_insert.get("total_points_eval", "")),
                bigquery.ScalarQueryParameter("percentage", "STRING", data_to_insert.get("percentage", "")),
                bigquery.ScalarQueryParameter("battery_checked_eval", "STRING", data_to_insert.get("battery_checked_eval", "")),
                bigquery.ScalarQueryParameter("wind_screen_checked_eval", "STRING", data_to_insert.get("wind_screen_checked_eval", "")),
                bigquery.ScalarQueryParameter("summary", "STRING", data_to_insert.get("summary", "")),
                bigquery.ScalarQueryParameter("video_url", "STRING", data_to_insert.get("video_url", "")),
            ]
        )
        
        # Execute the query
        query_job = bigquery_client.query(query, job_config=job_config)
        query_job.result()  # Wait for the job to complete
        
        logger.info(f"Data successfully inserted into BigQuery for filename: {data_to_insert.get('filename', 'unknown')}")
        
    except Exception as e:
        logger.error(f"Error inserting into BigQuery: {e}")
        # Don't raise exception here to avoid breaking the main flow
        # The analysis can still succeed even if BigQuery insertion fails

def clean_json_data(input_data):
    """Clean JSON response data from AI model"""
    logger.info("Cleaning the JSON response data")
    cleaned_data = input_data.replace('```json', '').replace('```', '').replace('\n', ' ').strip()
    return cleaned_data

def generate_content_from_url(url, system_instructions):
    vertexai.init(project=project_id)
    
    model = GenerativeModel("gemini-2.5-pro", system_instruction=system_instructions )
    
    video_file = Part.from_uri(
        uri=url,
        mime_type="video/mp4",
    )
    file_name = url.split("/")[-1]
    example_output = """[
        {
            "filename": "example_file.mp4",
            "car_type": "Passenger Car",
            "service_related_video": "Y",
            "sound_and_image": "Y",
            "show_license_plate": "Y",
            "car_on_ramp": "Y",
            "service_advisor_or_technician_name": "Y",
            "DealershipName": "Y",
            "special_tools_tyres": "Y",
            "customer_name": "Y",
            "special_tools_brake_pad": "Y",
            "Special_tools_disc": "Y",
            "attached_offer_mentioned": "Y",
            "approve_offer_mentioned":"Y",
            "correct_ending": "Y",
            "show_license_plate_eval": " ",
            "car_on_ramp_eval": " ",
            "service_advisor_or_technician_name_eval": "10",
            "DealershipName_eval": "10",
            "customer_name_eval": "10",
            "special_tools_tyres_eval": "20",
            "special_tools_brake_pad_eval": "20",
            "Special_tools_disc_eval": "20",
            "attached_offer_mentioned_eval": "10",
            "approve_offer_mentioned_eval": "10",
            "correct_ending_eval": "5",
            "total_points_eval": "100",
            "percentage": "100%",
            "battery_checked_eval": "100%",
            "wind_screen_checked_eval": "100%",
            "summary": "description of the video",
            "diagnostic_or_not": "Evhc",
            "transcript": "transcript of the video to english",
            "comments":" "
            
        }
    ]"""

    prompt = f"""
            You are an advanced EU Service Video Analysis model. Your task is to analyze the provided video based on specific conditions and provide a detailed analysis in JSON format. 
            Follow the instructions below to ensure the analysis is accurate and adheres to the specified requirements.\n 

            **Output format**: Provide only valid JSON as an output response and every value should be a string or an empty string (null)

            **Example output format**:
            {example_output}

            In output you should not include any other format other than JSON.

            Step 1. Conditions Verification:
                    Before proceeding with the analysis, verify the following conditions:
                    Condition 1: Is the video related to {car} cars? 
                    Condition 2: Does the video contain audio? 
                    Condition 3: Can the car in the video be identified? 
                    Condition 4: Is the car confirmed as a {car} model? 
                    Condition 5: Is the video clear enough for analysis? 

            If any one condition fails (i.e., the vehicle is not a {car} car, the video does not contain sound, the car is not confirmed as a {car}, the video is unclear, or {car} is not visible in the video), respond with the following output format:

            Step 2. If Any Condition Fails: Provide the following JSON format:\n [{{ 
                "filename": "{file_name}", 
                "car_type": "Non {car}", 
                "service_related_video": "", 
                "sound_and_image": "", 
                "show_license_plate": "", 
                "car_on_ramp": "", 
                "service_advisor_or_technician_name": "", 
                "DealershipName": "", 
                "special_tools_tyres": "", 
                "customer_name": "", 
                "special_tools_brake_pad": "", 
                "Special_tools_disc": "", 
                "attached_offer_mentioned": "", 
                "correct_ending": "", 
                "show_license_plate_eval": "", 
                "car_on_ramp_eval": "", 
                "service_advisor_or_technician_name_eval": "", 
                "DealershipName_eval": "", 
                "customer_name_eval": "", 
                "special_tools_tyres_eval": "", 
                "special_tools_brake_pad_eval": "", 
                "Special_tools_disc_eval": "", 
                "attached_offer_mentioned_eval": "",
                "approve_offer_mentioned_eval": "", 
                "correct_ending_eval": "", 
                "total_points_eval": "",
                "percentage": "", 
                "battery_checked_eval": "", 
                "wind_screen_checked_eval": "", 
                "summary": "",
                "diagnostic_or_not": ""
                "transcript": "",
                "comments":""
                }}]\n 

            Step 3. If All Conditions Pass: If all conditions are met (i.e., the vehicle is confirmed as a {car}, the video has 
            sound, the car is visible and identifiable as a {car}, and the video is clear), then populate the following fields in 
            the JSON format:\n [{{ 

                "filename": "{file_name}",
                "car_type": "Passenger Car" or "Commercial Car",
                "service_related_video": "Y" or "N",
                "sound_and_image": "Y" or "N",
                "show_license_plate": "Y" or "N",
                "car_on_ramp": "Y" or "N" or "N/A",
                "service_advisor_or_technician_name": "Y if name available or N",
                "DealershipName":"Compare the dealership name mentioned in the video audio/transcript with the dealership name present in the filename '{file_name}'. If the dealership name from the video matches or is substantially similar to the dealership name in the filename, return 'Y'. If they do not match or if no dealership name is mentioned in the video, return 'N'. For matching, consider variations in spelling, abbreviations, and common business name formats (e.g., '{car} Dealership' vs '{car}', 'Auto Center' vs 'Auto Centre', etc.)",
                "customer_name": "Y" or "N",
                "attached_offer_mentioned": "Return 'Y' if the technician explicitly states that a written estimate, quote, or service proposal is attached, included, or provided along with the video. Look for specific phrases like 'I've attached...', 'attached to this video...', 'including with this video...', 'estimate is attached...', 'quote included...', 'proposal attached...', or similar attachment language. Return 'N' if only verbal pricing is mentioned  or nothing is said about it"
                "approve_offer_mentioned":"approve_offer_mentioned": "Return 'Y' if the technician explicitly mentions that the attached offer/estimate/quote needs to be approved by the customer before proceeding with the work. Look for specific phrases like 'please approve this estimate...', 'approval needed for...', 'approve the attached quote...', 'need your approval to proceed...', 'once you approve this estimate...', 'pending your approval...', 'authorization required...', or similar approval request language. Return 'N' if no approval request is made, or if the technician only mentions prices/estimates without requesting approval.",
                "correct_ending": "Y" or "N",
                "show_license_plate_eval": "make this data as blank with no data or string",   
                "service_advisor_or_technician_name_eval": "Out of 10 based on service_advisor_or_technician_name column,, award 0 if it is "N" award 10 if it is "Y"",  
                "DealershipName_eval": "Out of 10  based on DealershipName column, award 0 if it is "N" award 10 if it is "Y"",  
                "customer_name_eval": "Out of 10 based on customer_name column, award 0 if it is "N" award 10 if it is "Y"",  
                "attached_offer_mentioned_eval": "Out of 10 based on attached_offer_mentioned column",
                "approve_offer_mentioned_eval": "Out of 10 based on approve_offer_mentioned column",
                "correct_ending_eval": "Out of 5 based on correct_ending column",  
                "total_points_eval": "Out of 100",  
                "percentage": "Percentage based on the points retrieved Out of 100%",  
                "battery_checked_eval": "Out of 100%",  
                "wind_screen_checked_eval": "Out of 100%",
                "summary": "Generate a summary based on the given video",
                "diagnostic_or_not": "Classify as either 'diagnostic' or 'Evhc' based on the following criteria:\n\n"
                                      "**Evhc (Electronic Vehicle Health Check):**\n"
                                      "- IF the transcript contains (case-insensitive) any of the following phrases: '{car} Video Check', 'digital Vehicle Health Check', 'complementary Vehicle Health Check', 'electronic Vehicle Health Check', 'Vehicle Health Check',\n"
                                      "OR the video *primarily* demonstrates general vehicle inspection tasks such as tire tread checks, brake shoe checks, disc checks, windshield checks, and battery checks,\n"
                                      "OR IF any minor tasks are performed, they are limited to filling fluids (washer fluid, brake fluid, etc.), adjusting tire pressure, or performing basic cleaning related to brakes, tires, and discs,\n"
                                      "THEN classify as 'Evhc'.\n\n"
                                      "**Diagnostic:**\n"
                                      "- IF the transcript contains (case-insensitive) any of the following words: 'Diagnostic', 'Follow Up', or 'Additional Work Identified',\n"
                                      "OR IF the video includes *any* component or part replacement, it is classified as Diagnostic, regardless of any other criteria that might suggest Evhc,\n"
                                      "OR IF the video demonstrates work that goes *beyond* a general check-up (i.e., tasks that are not part of a standard Evhc process),\n"
                                      "OR IF the video shows component replacements performed under warranty or as part of a recall process (e.g., door switches, airbag issues, or any car manufacturing defect), it is classified as Diagnostic, regardless of any other criteria that might suggest Evhc,\n"
                                      "OR IF the video includes body work, battery repair (which includes any additional work, repair, or replacement of the battery beyond a simple voltage check and visual inspection), windshield repair, or addresses mechanical failures (defined as any failure in the car other than brakes, discs, or tire components),\n"
                                      "THEN classify as 'diagnostic'.\n\n"
                                      "**Conflict Resolution:**\n"
                                      "- IF both the 'Evhc' and 'diagnostic' criteria are met, classify as 'diagnostic'.\n\n"
                                      "**Default Behavior:**\n"
                                      "- If *neither* of the above conditions is met, classify as 'Evhc'.",
                "special_tools_tyres": "Confirm proper tyre inspection procedure by analyzing BOTH video content AND audio/transcript. 
                                        Return 'Y' only if ALL conditions are met: 
                                                    (1) The video visually shows a tyre depth gauge being used to measure minimum 1 tyre per axle, 
                                                    (2) The tool is properly inserted into the tyre tread grooves for measurement, 
                                                    (3) The audio/transcript mentions or describes the use of tyre depth gauge and explains the measurement limits ({car} recommendation 3mm or legal limit 1.6mm). 
                                                    If the video is an EVHC video, this should be either Y or N (not N/A). 
                                                    If diagnostic_or_not is 'diagnostic', set to 'N/A' unless the video specifically shows AND mentions proper tyre depth measurement using the gauge with limit explanations.
                                                    If any condition is missing, set to 'N'."
                "special_tools_brake_pad": "Confirm proper brake pad inspection procedure by analyzing BOTH video content AND audio/transcript. 
                                           Return 'Y' only if ALL conditions are met: 
                                                   (1) The video visually shows a brake pad thickness tool being used against one pad, 
                                                   (2) The tool is correctly used and properly inserted at the brake pad location, 
                                                   (3) The audio/transcript mentions or describes the brake pad measurement and explains the results (Green, Amber, or Red) with wornness explanation including color, percentage, or mileage, 
                                                   (4) If pads are worn, shows measurement of one per axle (unless drums are fitted). 
                                                   If diagnostic_or_not is 'diagnostic', set to 'N/A' unless the video specifically shows AND mentions proper brake pad thickness measurement with result explanations. 
                                                   If any condition is missing, set to 'N'."
                "Special_tools_disc": "Confirm proper brake disc/drum inspection procedure by analyzing BOTH video content AND audio/transcript. 
                                           Return 'Y' only if ALL conditions are met: 
                                                  (1) The video visually shows and explains the condition of one disc/drum per axle, 
                                                  (2) If discs are worn, shows measurement of one per axle with the measurement tool visibly affixed to the disc, 
                                                  (3) The audio/transcript mentions or describes the disc/drum condition assessment and measurement process when applicable. 
                                                  If diagnostic_or_not is 'diagnostic', set to 'N/A' unless the video specifically shows AND mentions proper disc/drum condition assessment with measurement when worn. 
                                                  If any condition is missing, set to 'N'.",
                "car_on_ramp": "If diagnostic_or_not is 'diagnostic', set to 'N/A' unless the video *specifically* shows the car being raised on a ramp for inspection purposes. If the car is on a ramp for inspection, set to 'Y'. Otherwise, set to 'N'.",
                "special_tools_tyres_eval": "If special_tools_tyres is 'Y', award 20 points. If special_tools_tyres is 'N', award 0 points. If special_tools_tyres is 'N/A', award 20 points.",
                "special_tools_brake_pad_eval": "If special_tools_brake_pad is 'Y', award 20 points. If special_tools_brake_pad is 'N', award 0 points. If special_tools_brake_pad is 'N/A', award 20 points.",
                "Special_tools_disc_eval": "If Special_tools_disc is 'Y', award 20 points. If Special_tools_disc is 'N', award 0 points. If Special_tools_disc is 'N/A', award 20 points.",
                "car_on_ramp_eval": "If car_on_ramp is 'Y', award 5 points. If car_on_ramp is 'N', award 0 points. If car_on_ramp is 'N/A', award 5 points.",
                "transcript": "Generate a transcript of the video to english",
                "comments":"Reason for 'diagnostic_or_not' column prediction, explaining whether the 'Evhc' or 'diagnostic' criteria were met (or why neither was met, leading to the default 'diagnostic' classification). Be specific about the keywords found in the transcript and the types of tasks shown in the video. If both criteria were met, indicate that the 'diagnostic' classification takes precedence."

            }}]\n\n

            Important Note: Customer, Technician, and Dealer name fields contribute a maximum of 10 points to the total score. 
            These three fields — service_advisor_or_technician_name_eval (10 points if present), 
            DealershipName_eval (10 point if present), and customer_name_eval (10 point if present) — are considered mutually exclusive for scoring purposes. 
            Scoring Logic for total_points_eval:
            - If 0 or 1 field in (service_advisor_or_technician_name,DealershipName,customer_name) is YES: Add 0 points to total_points_eval (minimum threshold not met)
            - If 2 or 3 fields in (service_advisor_or_technician_name,DealershipName,customer_name) are YES: Add 10 points to total_points_eval (threshold met, award maximum points)
            When calculating total_points_eval and percentage, at least 2 out of these 3 fields must be present (10 points each) to contribute any points to the total score. If this threshold is not met, award 0 points for this category.

            Step 4. Output Format: Ensure every value is either a valid string or an empty string (null). The response must always 
            be in valid JSON format. Use the exact structure and syntax provided above.\n

            Step 5. Multilingual Video Support:\n
            Language Detection: Ensure that the system can detect and identify the language of the video's audio or captions. If 
            the video has captions, analyze them as well, even if they are in different languages.

            Text or Audio Translation: If the video is in a language that is not English, try to translate the audio or captions 
            into English for accurate analysis. If translation is not possible, mention the language and provide the analysis 
            based on available content.

            Language in the Audio: If the audio is in a language other than English, ensure that the conditions about 
            service-related content, special tools, or customer names are evaluated in the context of that language. Keep the 
            analysis consistent across languages.

            Video Sound and Image Clarification: If the language affects sound (e.g., technical terms in a non-English language), 
            make sure to evaluate whether these terms are understandable based on the video content, even if the language is 
            different.\n
            Important Note:\n
            If the video does not meet the conditions (e.g., if the {car} car is not visible, if the audio is missing, 
            or if the video is unclear), return the output format specified in Step 2.
            If all conditions pass, proceed with the 
            JSON format specified in Step 3 and provide detailed evaluations based on the analysis."""
    
    
    contents = [video_file, prompt]

    response = model.generate_content(contents)
    print(response.text)
    cleaned_response = clean_json_data(response.text)
    json_response = json.loads(cleaned_response)
    if isinstance(json_response, dict) and "data" in json_response:
        logger.error("Error in response data in uploaded file")
        raise HTTPException(status_code=400, detail=str(json_response["data"]))
    else:
        return json_response

def analyzing_videos(url, system_instructions, file_public_url):
    """Main function to analyze videos using Vertex AI"""
    try:
        logger.info(f"Starting video analysis for URL: {url}")
        
        # Generate analysis using Vertex AI
        generated_result = generate_content_from_url(url, system_instructions)
        
        # Add video URL to the result
        for item in generated_result:
            item["video_url"] = file_public_url
        file_name = url.split("/")[-1]
        
        generated_result[0]['show_license_plate_eval'] = 0

        if generated_result[0]['filename'] != file_name:
            generated_result[0]['filename'] = file_name
        # Insert into BigQuery (non-blocking)
        try:
            insert_into_bigquery(generated_result[0])
        except Exception as bigquery_error:
            logger.warning(f"BigQuery insertion failed, but continuing: {bigquery_error}")
        
        # Extract summary
        summary = [generated_result[0].get('summary', '')]

        return {
            "response": generated_result,
            "summary": summary
        }
        
    except Exception as e:
        logger.error(f"Error in analyzing_videos: {e}")
        raise HTTPException(status_code=500, detail=f"Video analysis failed: {str(e)}")

def upload_to_gcs(file: UploadFile, bucket_name: str, folder_name: str):
    """Uploads a file to a specified folder in GCS and returns the gs:// URL."""
    try:
        logger.info(f"Uploading file {file.filename} to GCS bucket {bucket_name}/{folder_name}")
        
        # Use lazy-initialized client
        storage_client = get_storage_client()
        bucket = storage_client.get_bucket(bucket_name)

        # Construct the full path for the file inside the folder
        blob_name = f"{folder_name}/{file.filename}"
        blob = bucket.blob(blob_name)

        # Upload the file to the specified folder in the bucket
        blob.upload_from_file(file.file, content_type=file.content_type)

        # Return the gs:// URL for the file
        gcs_url = f"gs://{bucket_name}/{blob.name}"
        public_url = f"https://storage.cloud.google.com/{bucket_name}/{blob.name}"
        
        logger.info(f"File uploaded successfully: {gcs_url}")
        return {"gcs_url": gcs_url, "file_public_url": public_url}
        
    except Exception as e:
        logger.error(f"Error uploading to GCS: {e}")
        raise HTTPException(status_code=500, detail=f"GCS upload failed: {str(e)}")

def upload_to_cloud_storage(file, system_instructions):
    """Main function to upload file to GCS and analyze"""
    try:
        # Validate file type
        if file.content_type not in ["video/mp4", "video/mkv", "video/avi"]:
            raise HTTPException(
                status_code=400, 
                detail="Invalid file type. Only MP4, MKV, and AVI files are allowed."
            )
        
        bucket_name = bucket_id
        
        # Upload file to the specific folder in GCS
        url_result = upload_to_gcs(file, bucket_name, bucket_folder)
        
        # Analyze the uploaded video
        result = analyzing_videos(
            url_result["gcs_url"], 
            system_instructions, 
            url_result["file_public_url"]
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error in upload_to_cloud_storage: {e}")
        raise HTTPException(status_code=500, detail=f"Upload and analysis failed: {str(e)}")
