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
# Add this new endpoint to your existing FastAPI code

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

    


# Add these new endpoints to your existing FastAPI backend

@app.post("/create-word-level-karaoke-video")
async def create_word_level_karaoke_video(file: UploadFile = File(...)):
    """
    Create karaoke video with word-by-word highlighting
    """
    input_path = None
    output_path = None
    
    try:
        print(f"Processing file for word-level karaoke: {file.filename}")
        
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

        # Build word-by-word highlight filters
        text_filters = []
        
        # Create base subtitle track (all words in white)
        base_words = []
        for word in all_words:
            clean_text = word['text'].replace("'", "\\'").replace(":", "\\:")
            clean_text = clean_text.replace("(", "\\(").replace(")", "\\)")
            base_words.append(clean_text)
        
        full_text = " ".join(base_words)
        base_filter = f"drawtext=text='{full_text}':fontcolor=white:fontsize=20:box=1:boxcolor=black@0.8:boxborderw=3:x=(w-text_w)/2:y=h-th-30"
        text_filters.append(base_filter)
        
        # Create highlight filters for each word
        current_pos = 0
        for i, word in enumerate(all_words):
            word_text = word['text'].strip()
            if not word_text:
                continue
                
            # Calculate word position in the full text
            words_before = " ".join([w['text'].strip() for w in all_words[:i]])
            word_start_pos = len(words_before) + (1 if words_before else 0)  # +1 for space
            
            # Create highlight filter for this specific word
            clean_word = word_text.replace("'", "\\'").replace(":", "\\:")
            clean_word = clean_word.replace("(", "\\(").replace(")", "\\)")
            
            # Highlight this word in yellow during its timespan
            highlight_filter = f"drawtext=text='{clean_word}':fontcolor=yellow:fontsize=22:box=1:boxcolor=red@0.6:boxborderw=2:x=(w-text_w)/2+{word_start_pos*12}:y=h-th-30:enable='between(t,{word['start']},{word['end']})'"
            text_filters.append(highlight_filter)

        # Combine all filters
        if text_filters:
            video_filter = ",".join(text_filters)
        else:
            return {"error": "No text filters created"}

        print("Creating word-level karaoke video with FFmpeg...")
        
        # FFmpeg command with word-level highlighting
        command = [
            ffmpeg_path,
            "-i", input_path,
            "-vf", video_filter,
            "-c:v", "libx264",
            "-preset", "medium",  # Better quality for final output
            "-crf", "20",         # Higher quality
            "-c:a", "copy",
            "-y",
            output_path
        ]

        print("Running FFmpeg with word-level highlighting...")
        result = subprocess.run(command, capture_output=True, text=True, timeout=900)  # 15 min timeout
        
        print(f"FFmpeg exit code: {result.returncode}")
        
        if result.returncode != 0:
            print(f"FFmpeg error: {result.stderr[-1000:]}")
            # Try simpler approach if complex filtering fails
            return await create_simple_word_karaoke_video(input_path, all_words, output_path)

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

async def create_simple_word_karaoke_video(input_path: str, all_words: list, output_path: str):
    """
    Fallback: Create video with segment-by-segment highlighting
    """
    try:
        ffmpeg_path = "C:/ffmpeg/ffmpeg.exe"
        
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

        # Create text overlay filters for segments
        text_filters = []
        for segment in segments:
            clean_text = segment['text'].replace("'", "\\'").replace(":", "\\:")
            clean_text = clean_text.replace("(", "\\(").replace(")", "\\)")
            
            text_filter = f"drawtext=text='{clean_text}':fontcolor=yellow:fontsize=24:box=1:boxcolor=black@0.8:boxborderw=5:x=(w-text_w)/2:y=h-th-20:enable='between(t,{segment['start']},{segment['end']})'"
            text_filters.append(text_filter)

        if text_filters:
            video_filter = ",".join(text_filters)
        else:
            return {"error": "No fallback text filters created"}

        # Simple FFmpeg command
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
                "error": "Both word-level and fallback processing failed",
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

@app.post("/create-advanced-word-karaoke")
async def create_advanced_word_karaoke(file: UploadFile = File(...)):
    """
    Advanced word-level karaoke with 5-6 word windows and highlighting to match frontend
    """
    input_path = None
    subtitle_file = None
    output_path = None
    
    try:
        print(f"Creating advanced word karaoke for: {file.filename}")
        
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

        # Create ASS subtitle file with windowed karaoke
        subtitle_file = f"advanced_subs_{os.getpid()}.ass"
        ass_content = create_windowed_word_level_ass_subtitle(segments_list)
        
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

def create_windowed_word_level_ass_subtitle(segments_list):
    """
    Create ASS subtitle with 5-6 word windows and karaoke-style highlighting
    """
    ass_header = """[Script Info]
Title: Windowed Word-Level Karaoke
ScriptType: v4.00+

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,28,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,2,2,10,10,30,1
Style: Highlight,Arial,30,&H0000FFFF,&H00FFFFFF,&H00000000,&H0000FFFF,1,0,0,0,100,100,0,0,1,2,2,2,10,10,30,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    
    events = []
    window_size = 6  # Match frontend: 5-6 words per window
    
    for segment in segments_list:
        if hasattr(segment, 'words') and segment.words:
            all_words = segment.words
            
            # Generate sliding windows with overlap
            for i in range(0, len(all_words), window_size - 2):  # Overlap by 2 for smooth transitions
                end_i = min(i + window_size, len(all_words))
                window_words = all_words[i:end_i]
                
                if not window_words:
                    continue
                
                # Window timing: from first word's start to last word's end
                window_start = window_words[0].start
                window_end = window_words[-1].end
                
                # Create karaoke text with highlighting
                words_with_timing = []
                for word in window_words:
                    duration = int((word.end - word.start) * 100)  # centiseconds
                    clean_word = word.word.strip().replace('{', '').replace('}', '').replace('\\', '\\\\').replace(':', '\\:').replace(',', '\\,')
                    # Use \k for timing and \r to switch styles
                    words_with_timing.append(f"{{\\k{duration}}}{{\\rHighlight}}{clean_word}{{\\rDefault}}")
                
                karaoke_text = " ".join(words_with_timing)
                start_time = format_ass_time(window_start)
                end_time = format_ass_time(window_end)
                
                events.append(f"Dialogue: 0,{start_time},{end_time},Default,,0,0,0,karaoke,{karaoke_text}")
    
    return ass_header + "\n".join(events)

def format_ass_time(seconds):
    """Convert seconds to ASS time format (H:MM:SS.CC)"""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)