# Simple Dockerfile - no frontend building inside Docker
FROM python:3.11-slim

# proxy settings

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
