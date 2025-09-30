# Use CUDA runtime base image (GPU). If CPU-only on Railway, switch to python:3.11-slim
FROM nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04

# Set working directory
WORKDIR /app

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/usr/local/bin:/usr/bin:/bin:${PATH}"

# Install system dependencies including FFmpeg
RUN apt-get update -y && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    libavcodec-extra \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Create symbolic links for python and pip if needed
RUN ln -sf /usr/bin/python3 /usr/bin/python || true
RUN ln -sf /usr/bin/pip3 /usr/bin/pip || true

# Verify FFmpeg is installed and accessible
RUN ffmpeg -version || (echo "FFmpeg installation failed" && exit 1)

# Copy requirements first (for Docker cache)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of your backend code
COPY . .

# Expose FastAPI port (Railway will override this)
EXPOSE 8080

# Start FastAPI
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]