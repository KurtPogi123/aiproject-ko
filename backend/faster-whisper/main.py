from fastapi import FastAPI, File, UploadFile
from faster_whisper import WhisperModel
import uvicorn
import tempfile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# ✅ Allow requests from your Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # frontend dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load model once at startup
model = WhisperModel("tiny", device="cpu", compute_type="int8")

@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    segments, info = model.transcribe(tmp_path)

    transcript = "\n".join([seg.text for seg in segments])

    return {"language": info.language, "transcript": transcript}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
