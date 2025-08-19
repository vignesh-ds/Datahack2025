import axios from 'axios';

const API_BASE_URL = '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5 minutes for video processing
});

export const apiService = {
  // Get all files
  async getFiles() {
    console.log('Fetching files from backend...');
    const response = await api.get('/get-file-urls');
    console.log('Files API response:', response.data);
    return response.data;
  },

  // Get video data
  async getVideoData() {
    console.log('Fetching video data from backend...');
    const response = await api.get('/get-video-data');
    console.log('Video data API response:', response.data);
    return response.data;
  },
  
  // ... rest of your methods


  // Get single record
  async getSingleRecord(filename) {
    const response = await api.post('/single-record', { filename });
    return response.data;
  },

  // Analyze video
  // Analyze video
  async analyzeVideo(data) {
    const formData = new FormData();
    
    if (data.url) {
      formData.append('url', data.url);
      // Add url_type parameter to distinguish between GCS and direct URLs
      formData.append('url_type', data.url_type || 'gcs');
    }
    
    if (data.embedded_url) {
      formData.append('embedded_url', data.embedded_url);
    }
    
    if (data.file) {
      formData.append('file', data.file);
    }

    const response = await api.post('/analyze-video', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    return response.data;
  },



  // Delete file
  async deleteFile(filename) {
    const response = await api.post('/delete-data', { filename });
    return response.data;
  },
};

