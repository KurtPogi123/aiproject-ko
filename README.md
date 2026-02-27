# aiproject-ko

An AI-powered audio/video transcription application that creates karaoke-style videos with word-level subtitles. Transform your media files into engaging content with customizable caption styles.

## 🎯 Project Overview

This project consists of three main components:
- **Frontend (Next.js)**: Modern web interface for audio/video transcription with live caption preview
- **Backend (Python + FastAPI + Faster-Whisper)**: AI-powered transcription engine using OpenAI's Whisper model
- **Desktop App (Electron)**: Cross-platform desktop application for offline use

## ✨ Features

- 🎤 **Word-Level Transcription**: Precise word-by-word timestamps using Faster-Whisper
- 🎨 **Customizable Captions**: Font family, size, colors, stroke/outline, backgrounds
- 🎬 **Karaoke Video Generation**: Creates videos with highlighted words synced to audio
- ✏️ **Edit Transcripts**: Double-click any word to correct it
- 📱 **Multiple Styles**: CORP style (background box) or No Background (text stroke)
- 👁️ **Live Preview**: See your caption styling in real-time
- 💻 **Desktop & Web**: Run as Electron app or in browser

## 📋 Prerequisites

Before installation, make sure you have:
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Python** (v3.8 or higher) - [Download here](https://www.python.org/downloads/)
- **Git** - [Download here](https://git-scm.com/)
- **FFmpeg** (for video processing) - See setup instructions below

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/KurtPogi123/aiproject-ko.git
cd aiproject-ko
```

### 2. Backend Setup (Python + FastAPI + Faster-Whisper)

```bash
# Navigate to backend folder
cd backend/faster-whisper

# Create virtual environment (recommended)
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

#### Download FFmpeg (Required for Video Processing)

The backend needs FFmpeg to process videos and burn in subtitles. **FFmpeg DLLs are NOT included in the repository** due to GitHub's file size limits.

**Windows:**
1. Download FFmpeg from: [FFmpeg Builds](https://github.com/BtbN/FFmpeg-Builds/releases)
2. Download: `ffmpeg-master-latest-win64-gpl-shared.zip`
3. Extract the zip file
4. Copy these DLL files to `backend/faster-whisper/` folder:
   - `avcodec-62.dll` (or latest version)
   - `avfilter-11.dll` (or latest version)
   - `avformat-62.dll`
   - `avutil-60.dll`
   - `swresample-5.dll`
   - `swscale-9.dll`

**Alternative Windows download:** https://www.gyan.dev/ffmpeg/builds/ (choose "release builds" → "shared")

**Mac/Linux:**
```bash
# Mac (using Homebrew)
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get update
sudo apt-get install ffmpeg

# The Python backend will use system FFmpeg automatically
```

### 3. Frontend Setup (Next.js)

```bash
# Navigate to frontend folder (from project root)
cd aicode

# Install dependencies
npm install
# or
yarn install
```

### 4. Electron Desktop App Setup (Optional)

```bash
# Navigate to electron-app folder (from project root)
cd electron-app

# Install dependencies
npm install
# or
yarn install
```

## 🎮 Running the Application

### Option A: Run Web Version (Frontend + Backend)

**Terminal 1 - Start Backend:**
```bash
cd backend/faster-whisper
venv\Scripts\activate  # Activate virtual environment (Windows)
# source venv/bin/activate  # Mac/Linux
python main.py
```
The backend will start on `http://localhost:8000`

**Terminal 2 - Start Frontend:**
```bash
cd aicode
npm run dev
```
The frontend will start on `http://localhost:3000`

Open your browser and go to: **http://localhost:3000**

### Option B: Run Desktop App (Electron)

```bash
cd electron-app
npm start
```

The desktop app will automatically start the backend and open the Electron window.

## 📁 Project Structure

```
aiproject-ko/
├── aicode/                      # Next.js Frontend
│   ├── app/
│   │   ├── components/
│   │   ├── page.tsx            # Main UI page
│   │   ├── globals.css
│   │   └── layout.tsx
│   ├── public/
│   ├── package.json
│   └── next.config.js
│
├── backend/faster-whisper/     # Python Backend
│   ├── main.py                 # FastAPI server
│   ├── requirements.txt        # Python dependencies
│   ├── *.dll                   # FFmpeg DLLs (YOU NEED TO ADD THESE)
│   └── venv/                   # Virtual environment (after setup)
│
├── electron-app/               # Electron Desktop App
│   ├── main.js                 # Electron main process
│   ├── preload.js
│   └── package.json
│
└── README.md
```

## 🔧 Configuration

### Backend Configuration

Edit `backend/faster-whisper/main.py` if needed:
- **Port**: Default is `8000` (line: `uvicorn.run(app, host="0.0.0.0", port=8000)`)
- **Model**: Default is `tiny` for speed. Options: `tiny`, `base`, `small`, `medium`, `large`
  - Line: `model = WhisperModel("tiny", device="cpu", compute_type="int8")`
  - Larger models = better accuracy but slower

### Frontend Configuration

Create `aicode/.env.local` (if needed):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## 🎨 How to Use

1. **Upload Media File**: Drag & drop or click to select audio/video file (MP3, MP4, etc.)
2. **Get Transcript**: Click "Get Word-Level Transcript" to transcribe with word timestamps
3. **Preview Video**: Watch your video with live captions
4. **Customize Style**:
   - Choose font (Roboto, Poppins, Aptos Black)
   - Adjust font size
   - Set colors (text, highlight, background, border)
   - Choose style: CORP (background box) or No Background (text stroke)
   - Set words per screen (1-10 words)
5. **Edit Words**: Double-click any word in the transcript to correct it
6. **Download**: Click "Download Karaoke Video" to create the final video with captions

## 🐛 Troubleshooting

### Common Issues

**❌ "DLL not found" or "FFmpeg error":**
- Make sure FFmpeg DLLs are in `backend/faster-whisper/` folder
- Download from: https://github.com/BtbN/FFmpeg-Builds/releases
- Check that all 6 DLL files are present (avcodec, avfilter, avformat, avutil, swresample, swscale)
- Try restarting the backend after adding DLLs

**❌ Backend won't start:**
- Verify Python virtual environment is activated: `venv\Scripts\activate` (Windows)
- Check all dependencies are installed: `pip install -r requirements.txt`
- Make sure port 8000 is not in use by another application
- Check Python version: `python --version` (should be 3.8+)

**❌ Frontend can't connect to backend:**
- Verify backend is running on `http://localhost:8000`
- Check backend terminal for errors
- Try accessing `http://localhost:8000/health` in your browser
- If using different port, update frontend code in `aicode/app/page.tsx` (search for `localhost:8000`)

**❌ "Module not found" errors:**
- Frontend: Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Backend: Make sure virtual environment is activated, then: `pip install -r requirements.txt --upgrade`

**❌ Video download fails or creates corrupted file:**
- Check FFmpeg DLLs are correctly installed
- Check backend terminal for FFmpeg errors
- Try with a smaller video file first
- Make sure you have enough disk space

**❌ Transcription is slow:**
- The `tiny` model is fastest but less accurate
- Try upgrading to `base` or `small` model in `main.py`: `WhisperModel("base", ...)`
- For GPU acceleration, install CUDA and change `device="cpu"` to `device="cuda"`

## 📦 Dependencies

### Backend (Python)
- **faster-whisper**: AI transcription engine
- **fastapi**: Web framework for API
- **uvicorn**: ASGI server
- **python-multipart**: File upload handling
- **FFmpeg**: Video/audio processing (external dependency)

### Frontend (Next.js)
- **Next.js 14+**: React framework
- **React**: UI library
- **TypeScript**: Type safety
- **Lucide React**: Icons
- **Tailwind CSS**: Styling

### Electron
- **Electron**: Desktop app framework
- **electron-builder**: App packaging

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

[Your License Here - e.g., MIT]

## 👥 Author

**Kurt** - [@KurtPogi123](https://github.com/KurtPogi123)

## 🙏 Acknowledgments

- **OpenAI Whisper** for the amazing transcription model
- **Faster-Whisper** for the optimized Python implementation
- **FFmpeg** for video processing capabilities
- **Next.js** team for the incredible React framework
- **Anthropic Claude** for development assistance

---

## 📚 Additional Resources

- [Faster-Whisper Documentation](https://github.com/guillaumekln/faster-whisper)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Electron Documentation](https://www.electronjs.org/docs)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)

## 💡 Tips

- **Best Video Quality**: Use H.264/MP4 format for input videos
- **Faster Processing**: Use smaller Whisper models (tiny/base) for quick results
- **Better Accuracy**: Use larger models (medium/large) when quality matters
- **Caption Styles**: Experiment with different fonts and colors for your brand
- **Word Display**: Fewer words (1-3) creates TikTok-style effect, more words (6-10) for traditional karaoke

# FFmpeg Setup Required

⚠️ **IMPORTANT**: This folder requires FFmpeg DLLs to work. They are NOT included in the repository due to GitHub's 100MB file size limit.

## 📥 Download FFmpeg DLLs (Windows)

### Option 1: Automated Download (Recommended)

**Using PowerShell:**
```powershell
# Run this in PowerShell (from this folder)
.\download_ffmpeg.ps1
```

**Using Command Prompt:**
```cmd
# Run this in CMD (from this folder)
download_ffmpeg.bat
```

### Option 2: Manual Download

1. **Download FFmpeg:**
   - Go to: https://github.com/BtbN/FFmpeg-Builds/releases
   - Download: `ffmpeg-master-latest-win64-gpl-shared.zip`
   - Alternative: https://www.gyan.dev/ffmpeg/builds/ (choose "release builds" → "shared")

2. **Extract and Copy DLL Files:**
   - Extract the downloaded ZIP file
   - Navigate to the `bin/` folder inside
   - Copy these 6 DLL files to **this folder** (`backend/faster-whisper/`):
     ```
     ✅ avcodec-62.dll      (or avcodec-XX.dll - latest version)
     ✅ avfilter-11.dll     (or avfilter-XX.dll)
     ✅ avformat-62.dll     (or avformat-XX.dll)
     ✅ avutil-60.dll       (or avutil-XX.dll)
     ✅ swresample-5.dll    (or swresample-X.dll)
     ✅ swscale-9.dll       (or swscale-X.dll)
     ```

3. **Verify Installation:**
   - Check that all 6 DLL files are now in this folder
   - File sizes should be between 5MB - 100MB each

## 🍎 Mac/Linux Users

FFmpeg is installed system-wide:

**Mac (using Homebrew):**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**Fedora:**
```bash
sudo dnf install ffmpeg
```

## ✅ Verification

After installation, you can verify FFmpeg is working:

```bash
# Windows (if DLLs are in this folder)
python -c "import subprocess; subprocess.run(['ffmpeg', '-version'])"

# Mac/Linux
ffmpeg -version
```

## 🐛 Troubleshooting

**"DLL not found" error:**
- Make sure all 6 DLL files are in `backend/faster-whisper/` folder
- Check file names match (version numbers like 62, 11, etc. may vary)
- Restart your terminal/IDE after copying files

**"Cannot find ffmpeg" error:**
- Windows: Make sure DLLs are in the same folder as `main.py`
- Mac/Linux: Install system FFmpeg using package manager above

**Still not working?**
- Download from the alternative link: https://www.gyan.dev/ffmpeg/builds/
- Try the "release" build instead of "master"
- Make sure you downloaded the **"shared"** version, not "static"

## 📝 Why aren't DLLs included?

GitHub has a 100MB fWile size limit per file. The `avcodec-62.dll` file is ~100MB, which exceeds this limit. That's why you need to download them separately.

---

**Need help?** Open an issue on the GitHub repository.

**Need Help?** Open an issue on GitHub or contact the maintainer.

**Enjoying the project?** Give it a ⭐ on GitHub!