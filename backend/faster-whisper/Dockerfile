# Simple Python base - works on Railway free tier
FROM python:3.11-slim

WORKDIR /app

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive

# Install FFmpeg and system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libavcodec-extra \
    && rm -rf /var/lib/apt/lists/*

# Verify FFmpeg installation
RUN ffmpeg -version || (echo "FFmpeg installation failed" && exit 1)

# Copy requirements first (for Docker cache)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . .

# Expose FastAPI port
EXPOSE 8080

# Start FastAPI - use $PORT variable from Railway
CMD python -m uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}