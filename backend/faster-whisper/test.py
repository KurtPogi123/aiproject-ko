from faster_whisper import WhisperModel

# Load a small model for speed, you can change to "medium" or "large-v2"
model = WhisperModel("tiny", device="cpu", compute_type="int8")

# Use the real file path
segments, info = model.transcribe("tests/data/videoplayback (1).mp4")

print("Detected language:", info.language)
print("Transcription:")
for segment in segments:
    print(f"[{segment.start:.2f}s -> {segment.end:.2f}s] {segment.text}")
