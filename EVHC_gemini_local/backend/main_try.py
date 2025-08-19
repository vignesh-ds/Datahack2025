import asyncio
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Request
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import uvicorn
from typing import Optional
from dotenv import load_dotenv
import logging
from pydantic import BaseModel
import time
import io
import requests
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from starlette.datastructures import UploadFile as StarletteUploadFile

from pytubefix import YouTube
from pytubefix.cli import on_progress

# Logging configuration
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Ford proxy settings
def setup_ford_proxy():
    """Setup Ford corporate proxy settings"""
    proxy_settings = {
        'http_proxy': "http://internet.ford.com:83",
        'https_proxy': "http://internet.ford.com:83",
        'HTTP_PROXY': "http://internet.ford.com:83",
        'HTTPS_PROXY': "http://internet.ford.com:83",
        'NO_PROXY': ".ford.com,localhost,127.0.0.1,19.*",
        'no_proxy': ".ford.com,localhost,127.0.0.1,19.*"
    }
    
    for key, value in proxy_settings.items():
        os.environ[key] = value
        
    logger.info("Ford proxy settings configured")
    return proxy_settings

# Setup proxy at startup
PROXY_SETTINGS = setup_ford_proxy()

load_dotenv()

from controllers.Analyzing_video import analyzing_videos, upload_to_cloud_storage
from controllers.data_from_bigquery import get_data_from_bigquery
from controllers.delete_file import delete_from_gcs, delete_from_bigquery
from controllers.get_files_from_bucket import get_all_files
from controllers.get_video_file_data import get_video_file_data

# Custom UploadFile class with content_type support
class CustomUploadFile(StarletteUploadFile):
    def __init__(self, filename: str, file: io.BytesIO, content_type: str):
        super().__init__(filename=filename, file=file)
        self._content_type = content_type

    @property
    def content_type(self):
        return self._content_type

# Initialize FastAPI app
app = FastAPI()

# CORS configuration
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging configuration
# logging.basicConfig(level=logging.INFO)
# logger = logging.getLogger(__name__)

# Serve static files from "assets" folder
app.mount("/assets", StaticFiles(directory="dist/assets"), name="assets")

# Pydantic model for input validation
class FilenameRequest(BaseModel):
    filename: str

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

def citnow_fetch_video_as_file(url):
    """Fetch video from CitNow embedded URL with Ford proxy support"""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    
    # Add proxy settings for Chrome
    options.add_argument("--proxy-server=http://internet.ford.com:83")
    options.add_argument("--proxy-bypass-list=.ford.com,localhost,127.0.0.1")
    
    # Use your ChromeDriver path
    chrome_driver_path = r"C:\Users\BKANNA10\Downloads\chromedriver-win64_138\chromedriver-win64\chromedriver.exe"
    
    if not os.path.exists(chrome_driver_path):
        logger.error(f"ChromeDriver not found at: {chrome_driver_path}")
        raise HTTPException(status_code=500, detail=f"ChromeDriver not found at: {chrome_driver_path}")
    
    service = Service(chrome_driver_path)
    driver = None

    try:
        logger.info(f"Starting CitNow processing for URL: {url}")
        logger.info("Using Ford proxy: http://internet.ford.com:83")
        
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(60)  # Increased timeout for proxy
        driver.implicitly_wait(15)  # Increased wait time
        
        logger.info("Loading CitNow page...")
        driver.get(url)
        time.sleep(8)  # Wait for page to load through proxy

        logger.info("Extracting video data...")
        try:
            video_data = driver.execute_script("return videoOptions;")
        except Exception as e:
            logger.warning(f"Failed to get videoOptions: {e}")
            try:
                video_data = driver.execute_script("return window.videoOptions;")
            except Exception as e2:
                logger.error(f"Alternative approach also failed: {e2}")
                raise HTTPException(status_code=400, detail="Could not find videoOptions on the page")
        
        if not video_data:
            raise HTTPException(status_code=400, detail="No videoOptions found on the page")
            
        logger.info(f"Video data found: {video_data}")
        
        video_sources = video_data.get("videoSources", [])
        if not video_sources:
            raise HTTPException(status_code=400, detail="No video sources found in videoOptions")
            
        video_url = next((v["src"] for v in video_sources if v["type"] == "video/mp4"), None)
        
        # If no MP4, try any video source
        if not video_url and video_sources:
            video_url = video_sources[0].get("src")
            
        print("got url:", video_url)
        
        if not video_url:
            raise HTTPException(status_code=400, detail="Video URL not found in embedded URL")

        # Extract filename
        video_name = video_url.split("/")[-1]
        if not video_name or "." not in video_name:
            video_name = f"citnow_video_{int(time.time())}.mp4"
            
        logger.info(f"Downloading video: {video_name}")

        # Use proxy session for downloading
        session = get_proxy_session()
        
        # Better headers
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'Accept': 'video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5',
            'Accept-Encoding': 'identity',
            'Referer': url,
            'Connection': 'keep-alive',
        }
        
        logger.info(f"Downloading video through Ford proxy...")
        response = session.get(video_url, headers=headers, stream=True, timeout=120)
        response.raise_for_status()
        
        video_bytes = io.BytesIO()
        total_size = 0
        max_size = 100 * 1024 * 1024  # 100MB limit
        
        logger.info("Streaming video content...")
        for chunk in response.iter_content(chunk_size=8192):
            if chunk:
                total_size += len(chunk)
                if total_size > max_size:
                    raise HTTPException(status_code=413, detail="Video file too large (>100MB)")
                video_bytes.write(chunk)
                
        video_bytes.seek(0)
        logger.info(f"Video downloaded successfully through proxy. Size: {total_size} bytes")

        return CustomUploadFile(filename=video_name, file=video_bytes, content_type="video/mp4")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in CitNow processing: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"CitNow processing failed: {str(e)}")
    finally:
        if driver:
            try:
                driver.quit()
            except Exception as e:
                logger.warning(f"Error closing driver: {e}")

# Your system instructions (keep the same)
system_instructions = """You are an advanced EU Service Video Analysis model. Your task is to analyze the provided video. Follow the instructions below:

                1. **Conditions**: You must first verify below conditions before proceeding:
                   - Identify if the video is **related to Ford cars**.
                   - Identify if the video contains **audio**.
                   - Identify the **car** present in the Video.
                   - Identify if the car in the video is confirmed as a **Ford model**.
                   - Identify if the video is **clear enough** to analyze.

                2. Even one condition **failed** (i.e., the vehicle is not a Ford or the video has no sound or the car is not confirmed as a Ford model, or the video is not clear), respond with the following output format:\n
                   
                3. Analysis Process: If all initial conditions are satisfied (i.e., the vehicle is a Ford, the video has sound, the car is confirmed to be a Ford model, and the video is clear):

                       - Proceed with populating the following fields in the JSON format.
                       - Provide a summary and relevant evaluations as specified (e.g., license plate visibility, car on ramp, etc.).
                4. Output Format: Provide the following JSON structure as the output 
                    -if all conditions **passed**:
                        output response:

                            [
                                {
                                    "filename": "[name of the file]",
                                    "car_type": "passenger" or "Commercial Car",
                                    "service_related_video": "Yes" or "No",
                                    "sound_and_image": "Yes" or "No",
                                    "show_license_plate": "Yes" or "No",
                                    "car_on_ramp": "Yes" or "No" or "N/A",
                                    "service_advisor_or_technician_name": "name if available or No",
                                    "DealershipName": "Yes" or "No",
                                    "special_tools_tyres": "Yes" or "No" or "N/A",
                                    "customer_name": "Yes" or "No",
                                    "special_tools_brake_pad": "Yes" or "No" or "N/A",
                                    "Special_tools_disc": "Yes" or "No" or "N/A",
                                    "attached_offer_mentioned": "Yes" or "No",
                                    "correct_ending": "Yes" or "No",
                                    "show_license_plate_eval": "Out of 5 based on show_license_plate column",  
                                    "car_on_ramp_eval": "Out of 5 based on car_on_ramp column",  
                                    "service_advisor_or_technician_name_eval": "Out of 10 based on service_advisor_or_technician_name column",  
                                    "DealershipName_eval": "either 0 or 1 based on DealershipName column",  
                                    "customer_name_eval": "either 0 or 1 based on customer_name column",  
                                    "special_tools_tyres_eval": "Out of 20 based on special tools for tyres",  
                                    "special_tools_brake_pad_eval": "Out of 20 based on special tools for brake pad",  
                                    "Special_tools_disc_eval": "Out of 20 based on special tools for disc brakes",  
                                    "attached_offer_mentioned_eval": "Out of 10 based on attached_offer_mentioned column",  
                                    "approve_offer_mentioned_eval": "Out of 10",  
                                    "correct_ending_eval": "Out of 5 based on correct_ending column",  
                                    "total_points_eval": "Out of 100",  
                                    "percentage": "Percentage based on the points retrieved Out of 100%",  
                                    "battery_checked_eval": "Out of 100%",  
                                    "wind_screen_checked_eval": "Out of 100%", 
                                    "summary": "Generate a summary based on the given video"
                                }
                            ]

                        - if any condition **failed**:
                            output response:

                                [
                                {
                                    "filename": "[name of the file]",
                                    "car_type": "Non Ford",
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
                                    "summary": ""
                                }
                            ]

                5. Output Constraints: Ensure every value is either a valid string or an empty string (null), and the response must always be in valid JSON format.

                Important Note: If conditions are failed or passed then respond with provided respective formats only. mainly if conditions failed then respond with  particular format and strictly follow the conditions. The main condition you should follow is, the ford car should be visible. If it is not visible then you must treat it as a failed condition.\n 
                 """

@app.post("/api/analyze-video")
async def analyze_video(
        url: Optional[str] = Form(None),
        file: Optional[UploadFile] = File(None),
        embedded_url: Optional[str] = Form(None),
):
    logger.info(f"API called: analyze_video with url={url}, file={file.filename if file else None}, embedded_url={embedded_url}")

    if sum(bool(x) for x in [url, file, embedded_url]) > 1:
        logger.error("More than one input provided; raising exception.")
        raise HTTPException(status_code=422, detail="Provide only one of 'url', 'file', or 'embedded_url', not multiple.")

    try:
        if url:
            if url.startswith("gs://"):
                result = analyzing_videos(url, system_instructions, file_public_url=None)
                return result
            else:
                raise HTTPException(status_code=400, detail="Please provide only gcs url")

        if embedded_url:
            logger.info(f"Processing CitNow URL: {embedded_url}")
            video_file = citnow_fetch_video_as_file(embedded_url)
            result = upload_to_cloud_storage(video_file, system_instructions)
            return result

        if file:
            result = upload_to_cloud_storage(file, system_instructions)
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in analyze_video: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

# Add a test endpoint to verify proxy connectivity
@app.get("/api/test-proxy")
async def test_proxy():
    """Test Ford proxy connectivity"""
    try:
        session = get_proxy_session()
        
        # Test external connectivity through proxy
        test_urls = [
            "https://httpbin.org/ip",
            "https://www.google.com",
            "https://lts.eu.prod.citnow.com"  # Test CitNow domain specifically
        ]
        
        results = {}
        
        for test_url in test_urls:
            try:
                response = session.get(test_url, timeout=30)
                results[test_url] = {
                    "status": "success",
                    "status_code": response.status_code,
                    "response_size": len(response.content)
                }
                if "httpbin.org/ip" in test_url:
                    results[test_url]["ip_info"] = response.json()
            except Exception as e:
                results[test_url] = {
                    "status": "failed",
                    "error": str(e)
                }
        
        return {
            "proxy_configured": True,
            "proxy_server": "http://internet.ford.com:83",
            "test_results": results
        }
        
    except Exception as e:
        return {
            "proxy_configured": False,
            "error": str(e)
        }

# Your other endpoints remain the same...
@app.get("/api/get-file-urls")
async def get_urls():
    try:
        result = get_all_files()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/get-video-data")
async def get_video_data():
    try:
        data = get_data_from_bigquery()
        return {"data": data}
    except HTTPException as e:
        raise e

@app.post("/api/single-record")
async def get_records(request: FilenameRequest):
    try:
        result = get_video_file_data(request.filename)
        return result
    except Exception as e:
        logging.error(f"Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/delete-data")
async def delete_data(request: FilenameRequest):
    filename = request.filename
    logger.info(f"Received request to delete file: {filename}")

    gcs_task = delete_from_gcs(filename)
    bigquery_task = delete_from_bigquery(filename)
    await asyncio.gather(gcs_task, bigquery_task)

    return {"message": f"Data for file '{filename}' successfully deleted from both GCS and BigQuery."}

@app.get("/{path:path}")
async def get_index(request: Request, path: str):
    return FileResponse("dist/index.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
