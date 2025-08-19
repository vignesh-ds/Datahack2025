@echo off
echo ========================================
echo   Deploying AI Video Analyzer to GCP
echo ========================================

:: Replace with your actual project ID
set PROJECT_ID=ai-cop-demo
set SERVICE_NAME=ai-video-analyzer
set REGION=us-central1

echo Setting project to %PROJECT_ID%...
gcloud config set project %PROJECT_ID%

echo Building and submitting to Cloud Build...
gcloud builds submit --tag gcr.io/%PROJECT_ID%/%SERVICE_NAME% --timeout=1200s

if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

echo Deploying to Cloud Run...
gcloud run deploy %SERVICE_NAME% ^
    --image gcr.io/%PROJECT_ID%/%SERVICE_NAME% ^
    --platform managed ^
    --region %REGION% ^
    --allow-unauthenticated ^
    --memory 2Gi ^
    --cpu 2 ^
    --timeout 900s ^
    --port 8080 ^
    --max-instances 10

if errorlevel 1 (
    echo Deployment failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo   Deployment Successful! 🎉
echo ========================================
echo.
echo Getting service URL...
for /f %%i in ('gcloud run services describe %SERVICE_NAME% --platform managed --region %REGION% --format="value(status.url)"') do set SERVICE_URL=%%i

echo.
echo Your app is live at: %SERVICE_URL%
echo Health check: %SERVICE_URL%/health
echo API docs: %SERVICE_URL%/docs
echo.
pause
