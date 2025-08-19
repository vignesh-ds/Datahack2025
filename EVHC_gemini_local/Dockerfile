# Simple Dockerfile - no frontend building inside Docker
FROM python:3.11-slim

# Ford proxy settings
ENV HTTP_PROXY="http://internet.ford.com:83" \
    HTTPS_PROXY="http://internet.ford.com:83" \
    http_proxy="http://internet.ford.com:83" \
    https_proxy="http://internet.ford.com:83" \
    no_proxy="127.0.0.1,0.0.0.0,::1,localhost,.ford.com,.local,.testing,.internal,.googleapis.com,.google.internal,19.0.0.0/8,136.1.0.0/16,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

# Install minimal dependencies
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy and install Python requirements
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY backend/ ./

# Copy pre-built frontend (already built locally)
COPY frontend/dist ./dist

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Health check
HEALTHCHECK CMD curl -f http://localhost:${PORT}/health || exit 1

EXPOSE 8080

CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT}
