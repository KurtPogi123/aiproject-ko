from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
import tempfile
import os
import subprocess
import shlex
from typing import Optional

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

@app.post("/transcribe-with-words")
async def transcribe_with_words(file: UploadFile = File(...)):
    """Get transcription with word-level timestamps"""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        input_path = tmp.name

    try:
        # Enable word timestamps
        segments, info = model.transcribe(input_path, word_timestamps=True)
        segments_list = list(segments)
        
        # Extract word-level data
        word_segments = []
        full_transcript = ""
        
        for segment in segments_list:
            if hasattr(segment, 'words') and segment.words:
                segment_words = []
                for word in segment.words:
                    word_data = {
                        "word": word.word,
                        "start": word.start,
                        "end": word.end,
                        "probability": word.probability
                    }
                    segment_words.append(word_data)
                    full_transcript += word.word + " "
                
                word_segments.append({
                    "segment_start": segment.start,
                    "segment_end": segment.end,
                    "segment_text": segment.text.strip(),
                    "words": segment_words
                })
            else:
                # Fallback for segments without word timestamps
                word_segments.append({
                    "segment_start": segment.start,
                    "segment_end": segment.end,
                    "segment_text": segment.text.strip(),
                    "words": []
                })

        return {
            "language": info.language,
            "transcript": full_transcript.strip(),
            "segments": [
                {"start": seg.start, "end": seg.end, "text": seg.text.strip()}
                for seg in segments_list
            ],
            "word_segments": word_segments
        }
    finally:
        if os.path.exists(input_path):
            os.unlink(input_path)

@app.post("/create-advanced-word-karaoke")
async def create_advanced_word_karaoke(
    file: UploadFile = File(...),
    fontFamily: Optional[str] = Form("Roboto"),
    fontSize: Optional[str] = Form("20")
):
    """
    Advanced word-level karaoke with customizable fonts
    """
    input_path = None
    subtitle_file = None
    output_path = None
    
    try:
        print(f"Creating advanced word karaoke for: {file.filename}")
        print(f"Font settings - Family: {fontFamily}, Size: {fontSize}px")
        
        # Save input
        input_path = f"advanced_input_{os.getpid()}.mp4"
        with open(input_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        # Get word-level transcription
        segments, info = model.transcribe(input_path, word_timestamps=True)
        segments_list = list(segments)
        
        if not segments_list:
            return {"error": "No speech detected"}

        # Create ASS subtitle file with custom fonts
        subtitle_file = f"advanced_subs_{os.getpid()}.ass"
        ass_content = create_windowed_word_level_ass_subtitle_with_fonts(
            segments_list, fontFamily, int(fontSize)
        )
        
        with open(subtitle_file, 'w', encoding='utf-8') as f:
            f.write(ass_content)

        output_path = f"advanced_output_{os.getpid()}.mp4"
        ffmpeg_path = "C:/ffmpeg/ffmpeg.exe"

        if not os.path.exists(ffmpeg_path):
            return {"error": "FFmpeg not found"}

        # Use ASS subtitles with libass for rendering
        command = [
            ffmpeg_path,
            "-i", input_path,
            "-vf", f"ass='{subtitle_file}'",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "20",
            "-c:a", "copy",
            "-y",
            output_path
        ]

        print("Running FFmpeg command:", " ".join(command))
        result = subprocess.run(command, capture_output=True, text=True, timeout=900)

        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr[-1000:]}")
            return {"error": f"FFmpeg processing failed: {result.stderr[-500:]}"}

        if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
            return {"error": "Output file not created or too small"}

        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=f"advanced_word_karaoke_{file.filename}",
            headers={"Content-Disposition": f"attachment; filename=advanced_word_karaoke_{file.filename}"}
        )

    except Exception as e:
        print(f"Error: {str(e)}")
        return {"error": f"Advanced processing failed: {str(e)}"}
    
    finally:
        for temp_file in [input_path, subtitle_file]:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except:
                    pass

def get_font_name_for_ass(font_family: str) -> str:
    """Map frontend font names to system font names"""
    font_mapping = {
        "Roboto": "Roboto",
        "Poppins": "Poppins", 
        "Aptos Black": "Aptos"
    }
    return font_mapping.get(font_family, "Arial")

def create_windowed_word_level_ass_subtitle_with_fonts(segments_list, font_family: str, font_size: int):
    """
    Create ASS subtitle with 5-6 word windows, proper word boundaries and custom fonts
    """
    font_name = get_font_name_for_ass(font_family)
    font_weight = 1 if font_family == "Aptos Black" else 0  # Bold for Aptos Black
    
    # Clean ASS header with proper escaping
    ass_header = f"""[Script Info]
Title: Windowed Word-Level Karaoke
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},&H00FFFFFF,&H0000FFFF,&H00000000,&H80000000,{font_weight},0,0,0,100,100,0,0,1,2,1,2,10,10,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    events = []
    all_words = []
    
    # First, collect all words with their timing
    for segment in segments_list:
        if hasattr(segment, 'words') and segment.words:
            for word in segment.words:
                all_words.append({
                    'text': word.word.strip(),
                    'start': word.start,
                    'end': word.end
                })
    
    if not all_words:
        return ass_header
    
    # Create non-overlapping windows of 5-6 words
    window_size = 6
    processed_words = set()  # Track which words we've already processed
    
    i = 0
    while i < len(all_words):
        # Find the next unprocessed word
        while i < len(all_words) and i in processed_words:
            i += 1
        
        if i >= len(all_words):
            break
            
        # Create window starting from current unprocessed word
        window_words = []
        window_indices = []
        
        # Collect 5-6 words for this window
        j = i
        while len(window_words) < window_size and j < len(all_words):
            if j not in processed_words:
                window_words.append(all_words[j])
                window_indices.append(j)
            j += 1
        
        if not window_words:
            break
            
        # Mark these words as processed
        for idx in window_indices:
            processed_words.add(idx)
        
        # Window timing
        window_start = window_words[0]['start']
        window_end = window_words[-1]['end']
        
        # Create clean karaoke text
        karaoke_parts = []
        for word in window_words:
            duration = max(20, int((word['end'] - word['start']) * 100))
            
            # Clean the word text properly
            clean_word = word['text'].strip()
            if clean_word:
                # Remove problematic characters and escape properly for ASS
                clean_word = clean_word.replace('\\', '')  # Remove backslashes
                clean_word = clean_word.replace('{', '')   # Remove braces
                clean_word = clean_word.replace('}', '')
                clean_word = clean_word.replace('\n', ' ') # Replace newlines with spaces
                clean_word = clean_word.replace('\r', '')  # Remove carriage returns
                
                if clean_word:  # Only add if there's actual content
                    karaoke_parts.append(f"{{\\k{duration}}}{clean_word}")
        
        if karaoke_parts:
            karaoke_text = " ".join(karaoke_parts)
            start_time = format_ass_time(window_start)
            end_time = format_ass_time(window_end)
            
            events.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,karaoke,{karaoke_text}")
        
        # Move to next batch of words
        i = j
    
    return ass_header + "\n".join(events)

def format_ass_time(seconds):
    """Convert seconds to ASS time format (H:MM:SS.CC)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

@app.post("/create-word-level-karaoke-video")
async def create_word_level_karaoke_video(
    file: UploadFile = File(...),
    fontFamily: Optional[str] = Form("Roboto"),
    fontSize: Optional[str] = Form("20")
):
    """
    Create karaoke video with word-by-word highlighting and custom fonts
    """
    input_path = None
    output_path = None
    
    try:
        print(f"Processing file for word-level karaoke: {file.filename}")
        print(f"Font settings - Family: {fontFamily}, Size: {fontSize}px")
        
        # Save uploaded video
        input_path = f"input_{os.getpid()}.mp4"
        with open(input_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        print(f"Input saved: {os.path.getsize(input_path)} bytes")

        # Get word-level transcription
        segments, info = model.transcribe(input_path, word_timestamps=True)
        segments_list = list(segments)
        if not segments_list:
            return {"error": "No speech detected"}

        print(f"Transcribed {len(segments_list)} segments with word timestamps")

        # Extract all words with timestamps
        all_words = []
        for segment in segments_list:
            if hasattr(segment, 'words') and segment.words:
                for word in segment.words:
                    all_words.append({
                        'text': word.word.strip(),
                        'start': word.start,
                        'end': word.end
                    })

        if not all_words:
            return {"error": "No word-level timestamps available"}

        print(f"Extracted {len(all_words)} words with timestamps")

        # Create output path
        output_path = f"output_{os.getpid()}.mp4"
        ffmpeg_path = "C:/ffmpeg/ffmpeg.exe"
        
        if not os.path.exists(ffmpeg_path):
            return {"error": "FFmpeg not found"}

        # Get font settings
        font_size = int(fontSize)
        font_name = get_font_name_for_ass(fontFamily)

        # Build simplified word-by-word highlight filters with custom font
        text_filters = []
        
        # Create a single comprehensive filter that handles all words without duplication
        word_filters = []
        
        for i, word in enumerate(all_words):
            word_text = word['text'].strip()
            if not word_text:
                continue
                
            clean_word = word_text.replace("'", "\\'").replace(":", "\\:")
            clean_word = clean_word.replace("(", "\\(").replace(")", "\\)")
            
            # Create individual word filter that's only active during its time
            word_filter = f"drawtext=text='{clean_word}':fontcolor=yellow:fontsize={font_size}:box=1:boxcolor=black@0.8:boxborderw=2:x=(w-text_w)/2:y=h-th-30:enable='between(t,{word['start']},{word['end']})'"
            word_filters.append(word_filter)

        # Combine all word filters into a single video filter
        if word_filters:
            video_filter = ",".join(word_filters[:50])  # Limit to prevent command line overflow
        else:
            return {"error": "No text filters created"}

        print("Creating word-level karaoke video with FFmpeg...")
        
        # FFmpeg command with word-level highlighting and custom fonts
        command = [
            ffmpeg_path,
            "-i", input_path,
            "-vf", video_filter,
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "20",
            "-c:a", "copy",
            "-y",
            output_path
        ]

        print("Running FFmpeg with word-level highlighting...")
        result = subprocess.run(command, capture_output=True, text=True, timeout=900)
        
        print(f"FFmpeg exit code: {result.returncode}")
        
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr[-1000:]}")
            # Try simpler approach if complex filtering fails
            return await create_simple_word_karaoke_video(input_path, all_words, output_path, fontFamily, fontSize)

        if not os.path.exists(output_path):
            return {"error": "Output file not created"}

        output_size = os.path.getsize(output_path)
        print(f"Output size: {output_size} bytes")

        if output_size < 1000:
            return {"error": f"Output too small: {output_size} bytes"}

        return FileResponse(
            output_path,
            media_type="video/mp4", 
            filename=f"word_karaoke_{file.filename}",
            headers={"Content-Disposition": f"attachment; filename=word_karaoke_{file.filename}"}
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

async def create_simple_word_karaoke_video(input_path: str, all_words: list, output_path: str, font_family: str, font_size: str):
    """
    Fallback: Create video with segment-by-segment highlighting and custom fonts (single layer)
    """
    try:
        ffmpeg_path = "C:/ffmpeg/ffmpeg.exe"
        size = int(font_size)
        
        # Group words into segments for simpler processing
        segments = []
        current_segment = []
        segment_start = None
        
        for word in all_words:
            if not current_segment:
                segment_start = word['start']
            
            current_segment.append(word['text'])
            
            # Create segments of ~5 words or when there's a pause
            if len(current_segment) >= 5 or (len(current_segment) > 0 and word == all_words[-1]):
                segments.append({
                    'text': ' '.join(current_segment),
                    'start': segment_start,
                    'end': word['end']
                })
                current_segment = []
                segment_start = None

        # Create single text overlay filter for segments (no duplication)
        text_filters = []
        for segment in segments:
            clean_text = segment['text'].replace("'", "\\'").replace(":", "\\:")
            clean_text = clean_text.replace("(", "\\(").replace(")", "\\)")
            
            # Single filter per segment
            text_filter = f"drawtext=text='{clean_text}':fontcolor=yellow:fontsize={size}:box=1:boxcolor=black@0.8:boxborderw=3:x=(w-text_w)/2:y=h-th-30:enable='between(t,{segment['start']},{segment['end']})'"
            text_filters.append(text_filter)

        if text_filters:
            video_filter = ",".join(text_filters)
        else:
            return {"error": "No fallback text filters created"}

        # Simple FFmpeg command with single layer
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

        print("Running fallback FFmpeg command...")
        result = subprocess.run(command, capture_output=True, text=True, timeout=600)
        
        if result.returncode != 0:
            return {
                "error": "Fallback processing failed",
                "details": result.stderr[-500:]
            }

        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=f"simple_karaoke_{os.path.basename(input_path)}",
            headers={"Content-Disposition": f"attachment; filename=simple_karaoke_{os.path.basename(input_path)}"}
        )
        
    except Exception as e:
        return {"error": f"Fallback processing failed: {str(e)}"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)