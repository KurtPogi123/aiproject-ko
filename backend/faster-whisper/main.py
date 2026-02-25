from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel
from starlette.background import BackgroundTask
import tempfile
import os
import sys
import subprocess
from typing import Optional
import json

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://aiproject-ko-eight.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = WhisperModel("tiny", device="cpu", compute_type="int8")


def get_ffmpeg_path() -> str:
    """
    Look for ffmpeg in priority order:
      1. sys._MEIPASS  — where PyInstaller extracts bundled files at runtime
      2. Next to the .exe — alternative bundled location
      3. System PATH fallback
    """
    if getattr(sys, "frozen", False):
        meipass_dir = getattr(sys, "_MEIPASS", "")
        exe_dir = os.path.dirname(sys.executable)
        candidates = [
            os.path.join(meipass_dir, "ffmpeg.exe"),  # bundled inside exe (correct place)
            os.path.join(meipass_dir, "ffmpeg"),
            os.path.join(exe_dir, "ffmpeg.exe"),       # next to exe
            os.path.join(exe_dir, "ffmpeg"),
            "ffmpeg",                                   # system PATH
        ]
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        candidates = [
            os.path.join(base_dir, "ffmpeg.exe"),
            os.path.join(base_dir, "ffmpeg"),
            "ffmpeg",
        ]

    for c in candidates:
        if os.path.isfile(c):
            print(f"[ffmpeg] Found: {c}")
            return c

    print("[ffmpeg] Using system PATH")
    return "ffmpeg"


FFMPEG_PATH = get_ffmpeg_path()


def tmp_path(prefix: str, suffix: str) -> str:
    return os.path.join(tempfile.gettempdir(), f"{prefix}_{os.getpid()}{suffix}")


def format_time_srt(seconds: float) -> str:
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millisecs = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    input_path = tmp_path("input", ".mp4")
    try:
        with open(input_path, "wb") as f:
            f.write(await file.read())

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
    input_path = tmp_path("input_words", ".mp4")
    try:
        with open(input_path, "wb") as f:
            f.write(await file.read())

        segments, info = model.transcribe(input_path, word_timestamps=True)
        segments_list = list(segments)

        word_segments = []
        full_transcript = ""

        for segment in segments_list:
            if hasattr(segment, "words") and segment.words:
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
    fontSize: Optional[str] = Form("20"),
    textColor: Optional[str] = Form("#FFFFFF"),
    useStroke: Optional[str] = Form("false"),
    strokeWidth: Optional[str] = Form("2"),
    strokeColor: Optional[str] = Form("#000000"),
    backgroundColor: Optional[str] = Form("#F97316"),
    borderColor: Optional[str] = Form("#1E40AF"),
    highlightColor: Optional[str] = Form("#FFFF00"),
    boxPaddingLeftRight: Optional[str] = Form("3"),
    selectedStyle: Optional[str] = Form("CORP"),
    windowSize: Optional[str] = Form("6"),
    editedWordSegments: Optional[str] = Form(None)
):
    input_path = tmp_path("karaoke_input", ".mp4")
    subtitle_file = tmp_path("karaoke_subs", ".ass")
    output_path = tmp_path("karaoke_output", ".mp4")

    try:
        print(f"Creating advanced word karaoke for: {file.filename}")
        print(f"FFmpeg path: {FFMPEG_PATH}")
        print(f"FFmpeg exists: {os.path.isfile(FFMPEG_PATH)}")

        with open(input_path, "wb") as f:
            f.write(await file.read())

        if editedWordSegments and editedWordSegments != "null":
            print("Using edited word segments from frontend")
            word_segments_data = json.loads(editedWordSegments)

            class EditedWord:
                def __init__(self, word, start, end):
                    self.word = word
                    self.start = start
                    self.end = end

            class EditedSegment:
                def __init__(self, words):
                    self.words = [EditedWord(w["word"], w["start"], w["end"]) for w in words]

            segments_list = [EditedSegment(seg["words"]) for seg in word_segments_data if seg.get("words")]
        else:
            print("No edits provided, transcribing from scratch")
            segments, info = model.transcribe(input_path, word_timestamps=True)
            segments_list = list(segments)

        if not segments_list:
            return {"error": "No speech detected"}

        ass_content = create_word_level_ass_with_color_changes(
            segments_list,
            fontFamily,
            int(fontSize),
            textColor,
            useStroke.lower() == "true",
            strokeColor,
            float(strokeWidth),
            backgroundColor,
            borderColor,
            highlightColor,
            int(boxPaddingLeftRight),
            int(windowSize)
        )

        with open(subtitle_file, "w", encoding="utf-8") as f:
            f.write(ass_content)

        print("ASS subtitle file written:", subtitle_file)

        # Use just the filename + cwd to avoid Windows drive letter colon issue
        sub_filename = os.path.basename(subtitle_file)
        sub_dir = os.path.dirname(subtitle_file)

        command = [
            FFMPEG_PATH,
            "-i", input_path,
            "-vf", f"ass={sub_filename}",
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "20",
            "-c:a", "copy",
            "-y", output_path
        ]

        print("Running FFmpeg:", " ".join(command))

        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=900,
            cwd=sub_dir
        )

        if result.returncode != 0:
            print(f"FFmpeg stderr:\n{result.stderr[-2000:]}")
            return {"error": f"FFmpeg processing failed: {result.stderr[-500:]}"}

        if not os.path.exists(output_path) or os.path.getsize(output_path) < 1000:
            return {"error": "Output file not created or too small"}

        print(f"Output file size: {os.path.getsize(output_path)} bytes")

        return FileResponse(
            output_path,
            media_type="video/mp4",
            filename=f"advanced_word_karaoke_{file.filename}",
            headers={"Content-Disposition": f"attachment; filename=advanced_word_karaoke_{file.filename}"},
            background=_cleanup_task(output_path)
        )

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        if os.path.exists(output_path):
            os.unlink(output_path)
        return {"error": f"Advanced processing failed: {str(e)}"}

    finally:
        for temp_file in [input_path, subtitle_file]:
            if temp_file and os.path.exists(temp_file):
                try:
                    os.unlink(temp_file)
                except Exception:
                    pass


def _cleanup_task(path: str) -> BackgroundTask:
    def _delete():
        try:
            if os.path.exists(path):
                os.unlink(path)
                print(f"Cleaned up: {path}")
        except Exception as e:
            print(f"Cleanup failed for {path}: {e}")
    return BackgroundTask(_delete)


def get_font_name_for_ass(font_family: str) -> str:
    font_mapping = {
        "Roboto": "Roboto",
        "Poppins": "Poppins",
        "Aptos Black": "Aptos"
    }
    return font_mapping.get(font_family, "Arial")


def hex_to_ass_color(hex_color: str, alpha: str = "00") -> str:
    if hex_color.lower() == 'transparent':
        return "&HFF000000"

    hex_color = hex_color.lstrip("#")
    if len(hex_color) < 6:
        hex_color = hex_color.ljust(6, '0')

    r = int(hex_color[0:2], 16)
    g = int(hex_color[2:4], 16)
    b = int(hex_color[4:6], 16)
    return f"&H{alpha}{b:02X}{g:02X}{r:02X}"


def format_ass_time(seconds):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    centisecs = int((seconds % 1) * 100)
    return f"{hours}:{minutes:02d}:{secs:02d}.{centisecs:02d}"


def create_word_level_ass_with_color_changes(
    segments_list,
    font_family: str,
    font_size: int,
    text_color: str = "#FFFFFF",
    use_stroke: bool = False,
    stroke_color: str = "#000000",
    stroke_width: float = 2.0,
    background_color: str = "#F97316",
    border_color: str = "#1E40AF",
    highlight_color: str = "#FFFF00",
    box_padding_left_right: int = 15,
    window_size: int = 6
):
    font_name = get_font_name_for_ass(font_family)
    font_weight = 1 if font_family == "Aptos Black" else 0

    text_color_ass = hex_to_ass_color(text_color, "00")
    highlight_color_ass = hex_to_ass_color(highlight_color, "00")

    if use_stroke:
        border_style = 1
        outline_color = hex_to_ass_color(stroke_color, "00")
        back_color = hex_to_ass_color(background_color, "FF")
        outline_width = int(stroke_width)
    else:
        border_style = 4
        outline_color = hex_to_ass_color(border_color, "00")
        back_color = hex_to_ass_color(background_color, "00")
        outline_width = 4

    margin_v = 70
    margin_lr = 60
    letter_spacing = 2

    ass_header = f"""[Script Info]
Title: Word-Level Karaoke
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{font_name},{font_size},{text_color_ass},{highlight_color_ass},{outline_color},{back_color},{font_weight},0,0,0,100,100,{letter_spacing},0,{border_style},{outline_width},0,2,{margin_lr},{margin_lr},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

    events = []
    all_words = []

    for segment in segments_list:
        if hasattr(segment, "words") and segment.words:
            for word in segment.words:
                all_words.append({
                    "text": word.word.strip(),
                    "start": word.start,
                    "end": word.end
                })

    if not all_words:
        print("WARNING: No words found")
        return ass_header

    print(f"Total words: {len(all_words)}, window size: {window_size}")

    i = 0
    while i < len(all_words):
        window_end_idx = min(i + window_size, len(all_words))
        window_words = all_words[i:window_end_idx]

        if not window_words:
            break

        for active_idx, active_word in enumerate(window_words):
            subtitle_parts = []

            for display_idx, display_word in enumerate(window_words):
                word_text = display_word["text"].strip()
                if display_idx == active_idx:
                    subtitle_parts.append(f"{{\\c{highlight_color_ass}&}}{word_text}{{\\r}}")
                else:
                    subtitle_parts.append(f"{{\\c{text_color_ass}&}}{word_text}{{\\r}}")

            subtitle_text = " ".join(subtitle_parts)
            padding = " " * box_padding_left_right if not use_stroke else ""
            final_text = f"{padding}{subtitle_text}{padding}"

            word_start = format_ass_time(active_word["start"])
            word_end = format_ass_time(active_word["end"])

            events.append(
                f"Dialogue: 0,{word_start},{word_end},Default,,0,0,0,,{final_text}"
            )

        i = window_end_idx

    print(f"Generated {len(events)} subtitle events")
    return ass_header + "\n".join(events)


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)