from fastapi import FastAPI, File, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import tempfile
import os
import subprocess
import shlex

app = FastAPI()

# Allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load Whisper model once at startup
model = WhisperModel("tiny", device="cpu", compute_type="int8")

def format_time_srt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millisecs = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        input_path = tmp.name

    try:
        segments, info = model.transcribe(input_path)
        segments_list = list(segments)
        transcript = "\n".join([seg.text for seg in segments_list])

        return {
            "language": info.language,
            "transcript": transcript,
            "segments": [
                {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
                for seg in segments_list
            ]
        }
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)

@app.post("/create-srt")
async def create_srt(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        input_path = tmp.name

    try:
        segments, info = model.transcribe(input_path)
        segments_list = list(segments)
        if not segments_list:
            return {"error": "No speech detected"}

        srt_content = ""
        for i, seg in enumerate(segments_list, 1):
            start_time = format_time_srt(seg.start)
            end_time = format_time_srt(seg.end)
            srt_content += f"{i}\n{start_time} --> {end_time}\n{seg.text.strip()}\n\n"

        return {"srt_content": srt_content, "language": info.language}
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)

@app.post("/test-basic-conversion")
async def test_basic_conversion(file: UploadFile = File(...)):
    """Test basic video conversion without subtitles"""
    input_path = None
    output_path = None
    
    try:
        input_path = f"test_input_{os.getpid()}.mp4"
        output_path = f"test_output_{os.getpid()}.mp4"
        
        with open(input_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        ffmpeg_path = "C:/ffmpeg/ffmpeg.exe"
        
        command = [
            ffmpeg_path,
            "-i", input_path,
            "-t", "5",  # Only 5 seconds for testing
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-c:a", "aac",
            "-y",
            output_path
        ]
        
        result = subprocess.run(command, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0 and os.path.exists(output_path):
            size = os.path.getsize(output_path)
            return {
                "success": True, 
                "message": "Basic conversion works",
                "output_size": size
            }
        else:
            return {
                "success": False,
                "error": "Basic conversion failed",
                "stderr": result.stderr
            }
            
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        for temp_file in [input_path, output_path]:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except:
                    pass

@app.post("/create-karaoke-video")
async def create_karaoke_video(file: UploadFile = File(...)):
    """
    Create a video with burned-in subtitles
    """
    input_path = None
    srt_path = None
    output_path = None
    
    try:
        print(f"Processing file: {file.filename}")
        
        # Save uploaded video to a simple path
        input_path = f"temp_input_{os.getpid()}.mp4"
        with open(input_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        print(f"Input file saved: {input_path} ({os.path.getsize(input_path)} bytes)")

        # Get transcription
        segments, info = model.transcribe(input_path)
        segments_list = list(segments)
        if not segments_list:
            return {"error": "No speech detected"}

        print(f"Transcribed {len(segments_list)} segments")

        # Create SRT content
        srt_content = ""
        for i, seg in enumerate(segments_list, 1):
            start_time = format_time_srt(seg.start)
            end_time = format_time_srt(seg.end)
            text = seg.text.strip().replace("'", "").replace('"', '')  # Remove problematic characters
            srt_content += f"{i}\n{start_time} --> {end_time}\n{text}\n\n"

        # Save SRT file
        srt_path = f"temp_subs_{os.getpid()}.srt"
        with open(srt_path, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        
        print(f"SRT file created: {srt_path}")

        # Output path
        output_path = f"temp_output_{os.getpid()}.mp4"
        
        ffmpeg_path = "C:/ffmpeg/ffmpeg.exe"
        if not os.path.exists(ffmpeg_path):
            return {"error": "FFmpeg not found"}

        # Try the simplest possible approach
        command = [
            ffmpeg_path,
            "-i", input_path,
            "-vf", f"subtitles='{srt_path}':force_style='FontSize=20'",
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-crf", "28",
            "-c:a", "copy",  # Copy audio without re-encoding
            "-y",
            output_path
        ]

        print(f"Running command: {' '.join(command)}")
        
        result = subprocess.run(command, capture_output=True, text=True, timeout=300)
        
        print(f"FFmpeg exit code: {result.returncode}")
        if result.stderr:
            print(f"FFmpeg stderr: {result.stderr[-500:]}")  # Last 500 chars
        
        if result.returncode != 0:
            # Try without subtitles to see if basic conversion works
            print("Subtitle conversion failed, trying basic conversion...")
            basic_command = [
                ffmpeg_path,
                "-i", input_path,
                "-c:v", "libx264",
                "-preset", "ultrafast", 
                "-crf", "28",
                "-c:a", "copy",
                "-y",
                output_path
            ]
            
            basic_result = subprocess.run(basic_command, capture_output=True, text=True, timeout=180)
            
            if basic_result.returncode != 0:
                return {
                    "error": "Both subtitle and basic conversion failed",
                    "subtitle_error": result.stderr,
                    "basic_error": basic_result.stderr
                }
            else:
                return {
                    "error": "Subtitle burning failed, but basic conversion works. Issue is with subtitle processing.",
                    "subtitle_stderr": result.stderr,
                    "suggestion": "Try a different video file or check SRT content"
                }

        if not os.path.exists(output_path):
            return {"error": "Output file was not created"}

        output_size = os.path.getsize(output_path)
        print(f"Output file size: {output_size} bytes")

        if output_size < 1000:
            return {"error": f"Output file too small: {output_size} bytes"}

        # Simple integrity check
        integrity_cmd = [ffmpeg_path, "-v", "error", "-i", output_path, "-f", "null", "-", "-t", "1"]
        integrity_result = subprocess.run(integrity_cmd, capture_output=True, text=True, timeout=30)
        
        if integrity_result.returncode != 0:
            return {
                "error": "Output file integrity check failed",
                "details": integrity_result.stderr
            }

        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=f"karaoke_{file.filename}",
            headers={"Content-Disposition": f"attachment; filename=karaoke_{file.filename}"}
        )

    except Exception as e:
        import traceback
        print(f"Exception: {str(e)}")
        print(traceback.format_exc())
        return {"error": f"Processing failed: {str(e)}"}
    
    finally:
        # Clean up temp files
        for temp_file in [input_path, srt_path]:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                    print(f"Cleaned up: {temp_file}")
                except:
                    pass

@app.post("/create-karaoke-video-overlay")
async def create_karaoke_video_overlay(file: UploadFile = File(...)):
    """
    Create karaoke video using text overlay instead of subtitle files
    """
    input_path = None
    output_path = None
    
    try:
        print(f"Processing file: {file.filename}")
        
        # Save input file
        input_path = f"input_{os.getpid()}.mp4"
        with open(input_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        print(f"Input saved: {os.path.getsize(input_path)} bytes")

        # Get transcription
        segments, info = model.transcribe(input_path)
        segments_list = list(segments)
        if not segments_list:
            return {"error": "No speech detected"}

        # Create output path
        output_path = f"output_{os.getpid()}.mp4"
        ffmpeg_path = "C:/ffmpeg/ffmpeg.exe"
        
        if not os.path.exists(ffmpeg_path):
            return {"error": "FFmpeg not found"}

        # Build text overlay filters
        text_filters = []
        for i, seg in enumerate(segments_list):
            # Clean and escape text for FFmpeg
            text = seg.text.strip()
            text = text.replace("'", "\\'").replace(":", "\\:")
            text = text.replace("(", "\\(").replace(")", "\\)")
            
            # Create text overlay filter
            start_time = seg.start
            end_time = seg.end
            
            text_filter = f"drawtext=text='{text}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.8:boxborderw=5:x=(w-text_w)/2:y=h-th-20:enable='between(t,{start_time},{end_time})'"
            text_filters.append(text_filter)
        
        # Combine all text filters
        if text_filters:
            video_filter = ",".join(text_filters)
        else:
            return {"error": "No text to overlay"}

        # FFmpeg command with text overlay
        command = [
            ffmpeg_path,
            "-i", input_path,
            "-vf", video_filter,
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "23",
            "-c:a", "copy",
            "-y",
            output_path
        ]

        print("Running FFmpeg with text overlay...")
        print(f"Command: {' '.join(command[:5])} ... [text filters] ... {command[-3:]}")
        
        result = subprocess.run(command, capture_output=True, text=True, timeout=600)
        
        print(f"FFmpeg exit code: {result.returncode}")
        
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr[-500:]}")
            return {
                "error": "Text overlay failed", 
                "details": result.stderr[-500:]
            }

        if not os.path.exists(output_path):
            return {"error": "Output file not created"}

        output_size = os.path.getsize(output_path)
        print(f"Output size: {output_size} bytes")

        if output_size < 1000:
            return {"error": f"Output too small: {output_size} bytes"}

        return FileResponse(
            output_path,
            media_type="video/mp4", 
            filename=f"karaoke_overlay_{file.filename}",
            headers={"Content-Disposition": f"attachment; filename=karaoke_overlay_{file.filename}"}
        )

    except Exception as e:
        print(f"Error: {str(e)}")
        return {"error": f"Processing failed: {str(e)}"}
    
    finally:
        if input_path and os.path.exists(input_path):
            try:
                os.unlink(input_path)
            except:
                pass

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)