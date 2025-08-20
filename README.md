# Electronic Vehicle Health Check (eVHC) – AI-Powered Video Assessment

## 📌 Project Overview

This project is an **AI-driven electronic vehicle health check (eVHC)** system that automates vehicle inspection video assessments using **Google Vertex AI (gemini-2.5-pro)**.
The solution replaces manual quality checks with **Generative AI–powered automation**, delivering faster, more accurate evaluations, structured insights, and score generation.

---

## 🔎 Background

Traditionally, in the **Dealer Incentive Program**, technicians recorded repair videos which were manually checked for quality before providing quotes. This process was:

* Time-consuming
* Prone to human errors
* Difficult to scale

With this solution, video assessments are automated using **Generative AI**, making the process more **efficient, reliable, and scalable**.

---

## 🚀 Solution Overview

### ✨ Features

* **AI-Powered Analysis** → Automated inspection and diagnostic video analysis
* **Streamlined Insights** → Generates structured summaries and scores
* **Automation at Scale** → Reduces manual review effort, improves turnaround time

---

### 🔧 Capabilities

* **Video Management**

  * URL extraction & video downloading
  * Video type classification

* **AI-Powered Content Analysis**

  * Object recognition
  * Vehicle condition assessment
  * Speech-to-text transcription

* **Data Handling**

  * Data extraction & validation
  * Integration with **Google BigQuery** & **Cloud Storage**
  * Error handling & logging

* **Results**

  * Structured summary generation
  * Insights for Dealer Incentive programs

---

## 📂 Project Structure

```
EVHC_gemini_local/
│── .dockerignore                 # Docker build exclusions
│── .env.production               # Environment variables (production)
│── Dockerfile                    # Container setup
│── cloudbuild.yaml               # Google Cloud Build configuration  (⚠️ modify with your GCP project ID & settings)
│── deploy-artifact.bat           # Batch script for deployment (⚠️ update project ID and artifact details)
│── start.bat                     # Batch script to start backend + frontend
│── prompt_categorization_by_techniques.md     # Techniques for Prompt Categorization
│── backend/                      # Backend source code
│    ├── controllers/
│    │   ├── analyzing_video.py        # Analyze videos using Vertex AI LLM
│    │   ├── data_from_bigquery.py     # Fetch data from BigQuery
│    │   ├── delete_file.py            # Delete files from GCP bucket or BigQuery
│    │   ├── get_files_from_bucket.py  # Fetch data from Cloud Storage
│    │   ├── get_video_file_data.py    # Fetch video details from BigQuery
│    ├── main.py                        # Main entry point
│    └── requirements.txt               # Python dependencies
│── frontend/                     # Frontend source code
```

---

## ⚙️ Installation & Setup

### ✅ Prerequisites

1. **Python 3.10+**
2. **Google Cloud SDK** (for authentication)
3. **Docker** (if running containerized version)
4. **Node.js & npm** (for frontend, if applicable)
5. Clone the repository:

   ```bash
   git clone https://github.com/vignesh-ds/Datahack2025.git
   cd Datahack2025/EVHC_gemini_local
   ```

---

### 🔑 Authentication

Before running the script, authenticate with Google Cloud:

```bash
gcloud auth application-default login
```

This allows access to:

* **GCP Cloud Storage** (for video files)
* **BigQuery** (for data storage & queries)
* **Vertex AI** (for Generative AI model gemini-2.5-pro)

---

## 🏃 Running the Application

You can run the system in different ways depending on your workflow:

---

### ▶️ 1. Running with Python (Backend Only, Non-Docker)

1. Install backend dependencies (from inside the `backend` folder):

   ```bash
   pip install -r requirements.txt
   ```
2. Run the backend API:

   ```bash
   python backend/main.py
   ```

Backend will be available at [http://localhost:8000](http://localhost:8000).

---

### ▶️ 2. Running the Frontend (Only UI)

1. Navigate to the `frontend` directory:

   ```bash
   cd frontend
   ```
2. Install dependencies:

   ```bash
   npm install
   ```
3. Start the frontend application:

   ```bash
   npm start
   ```

Frontend will be available at [http://localhost:5173](http://localhost:5173) (default for Vite).

---

### ▶️ 3. Running with `start.bat` (Backend + Frontend Together)

If you want to start both **backend** and **frontend** at once, use the provided batch script:

```bat
start.bat
```

The script will:

* Start the **backend (FastAPI)** on [http://localhost:8000](http://localhost:8000)
* Start the **frontend (React/Vite)** on [http://localhost:5173](http://localhost:5173)

This is the easiest way to run both services for local development.

---

### ▶️ 4. Running with Docker

1. Build the Docker image from the project root:

   ```bash
   docker build -t evhc_gemini_local .
   ```
2. Run the container:

   ```bash
   docker run -d -p 8080:8080 evhc_gemini_local
   ```

---

## 🔗 Tech Stack

* **Google Vertex AI (gemini-2.5-pro)** → Generative AI model for analysis
* **Google BigQuery** → Data storage & querying
* **Google Cloud Storage** → Video storage
* **Python 3.10+** → Core development
* **FastAPI** → Backend API layer
* **Node.js/React (Vite)** → Frontend
* **Docker** → Containerization

Here’s a concise and professional way to present it in your README:

---

### 📽️ Implementation Demo Video

Due to file size limitations, only a partial demo video is included here.
For the complete implementation walkthrough, please access the full video via Google Drive:

👉 [Watch Full Demo Video](https://drive.google.com/file/d/12LCVv_IxvgOTxLbhzqeyU4zHQV7AE4fg/view?usp=sharing)

---

https://github.com/user-attachments/assets/1f97200a-ce15-4b88-b035-789482fb849d


