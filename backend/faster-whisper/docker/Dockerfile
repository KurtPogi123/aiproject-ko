# Use CUDA runtime base image (GPU). If CPU-only, switch to python:3.11-slim
FROM nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04

# Set working directory
WORKDIR /app

# Install system dependencies (pip + ffmpeg + build essentials)
RUN apt-get update -y && apt-get install -y \
    python3-pip \
    ffmpeg \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for Docker cache)
COPY requirements.txt .

# Install Python dependencies
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . .

# Expose FastAPI port
EXPOSE 8080

# Start FastAPI (update path if your app isn’t in main.py)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
