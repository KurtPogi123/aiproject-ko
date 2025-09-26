from fastapi import FastAPI, File, UploadFile
from faster_whisper import WhisperModel
import uvicorn
import tempfile
import os
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ✅ Allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
model = WhisperModel("tiny", device="cpu", compute_type="int8")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # Create temporary files
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        input_path = tmp.name
    
    try:
        # Transcribe the audio/video
        segments, info = model.transcribe(input_path)
        segments_list = list(segments)
        
        # Create transcript text
        transcript = "\n".join([seg.text for seg in segments_list])
        
        return {
            "language": info.language, 
            "transcript": transcript,
            "segments": [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text
                }
                for seg in segments_list
            ]
        }
    
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)

@app.post("/create-srt")
async def create_srt_subtitles(file: UploadFile = File(...)):
    """Create downloadable SRT subtitle file"""
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_input:
        tmp_input.write(await file.read())
        input_path = tmp_input.name
    
    try:
        # Transcribe
        segments, info = model.transcribe(input_path)
        segments_list = list(segments)
        
        if not segments_list:
            return {"error": "No speech detected"}
        
        # Create SRT content
        srt_content = ""
        for i, segment in enumerate(segments_list, 1):
            start_time = format_time_srt(segment.start)
            end_time = format_time_srt(segment.end)
            
            srt_content += f"{i}\n"
            srt_content += f"{start_time} --> {end_time}\n"
            srt_content += f"{segment.text.strip()}\n\n"
        
        return {
            "srt_content": srt_content,
            "language": info.language,
            "segments": [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text
                }
                for seg in segments_list
            ]
        }
        
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)

def format_time_srt(seconds):
    """Convert seconds to SRT time format"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millisecs = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"

@app.post("/transcribe-with-video")
async def transcribe_with_video_info(file: UploadFile = File(...)):
    """Get transcription data for video with timing info"""
    
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_input:
        tmp_input.write(await file.read())
        input_path = tmp_input.name
    
    try:
        # Transcribe
        segments, info = model.transcribe(input_path)
        segments_list = list(segments)
        
        if not segments_list:
            return {"error": "No speech detected"}
        
        # Create SRT content
        srt_content = ""
        for i, segment in enumerate(segments_list, 1):
            start_time = format_time_srt(segment.start)
            end_time = format_time_srt(segment.end)
            
            srt_content += f"{i}\n"
            srt_content += f"{start_time} --> {end_time}\n"
            srt_content += f"{segment.text.strip()}\n\n"
        
        return {
            "success": True,
            "srt_content": srt_content,
            "language": info.language,
            "transcript": "\n".join([seg.text for seg in segments_list]),
            "segments": [
                {
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip()
                }
                for seg in segments_list
            ]
        }
        
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)