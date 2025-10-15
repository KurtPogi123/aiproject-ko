"use client";
import { useState, useRef, useEffect, SetStateAction } from "react";
import {
  Upload,
  Video,
  Music,
  FileText,
  Loader2,
  CheckCircle,
  Copy,
  Trash2,
  AlertCircle,
  Download,
  Type,
  Palette,
  Maximize2,
} from "lucide-react";

interface WordData {
  word: string;
  start: number;
  end: number;
  probability: number;
}

interface WordSegment {
  segment_start: number;
  segment_end: number;
  segment_text: string;
  words: WordData[];
}

interface FontSettings {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  useStroke: boolean;
  strokeWidth: number;
  strokeColor: string;
  backgroundColor: string;
  borderColor: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [segments, setSegments] = useState<any[]>([]);
  const [wordSegments, setWordSegments] = useState<WordSegment[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentSegment, setCurrentSegment] = useState<number>(-1);
  const [currentWord, setCurrentWord] = useState<{ segmentIndex: number; wordIndex: number } | null>(null);
  const [currentWordWindow, setCurrentWordWindow] = useState<WordData[]>([]);
  const [editingWord, setEditingWord] = useState<{ segmentIndex: number; wordIndex: number } | null>(null);
  const [editedWordValue, setEditedWordValue] = useState<string>("");
  const [windowSize, setWindowSize] = useState<number>(6);
  
  const [fontSettings, setFontSettings] = useState<FontSettings>({
    fontFamily: 'Aptos Black',
    fontSize: 24,
    textColor: '#FFFFFF',
    useStroke: false,
    strokeWidth: 2,
    strokeColor: '#000000',
    backgroundColor: '#F97316',
    borderColor: '#1E40AF',
  });
  const [selectedStyle, setSelectedStyle] = useState<'CORP' | 'NoBackground'>('CORP');

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const availableFonts = [
    { name: 'Roboto', value: 'Roboto, sans-serif' },
    { name: 'Poppins', value: 'Poppins, sans-serif' },
    { name: 'Aptos Black', value: 'Aptos, -apple-system, BlinkMacSystemFont, sans-serif' }
  ];

  useEffect(() => {
    if (file && file.type.startsWith("video/")) {
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setVideoUrl(null);
      };
    }
  }, [file]);

  const handleTimeUpdate = () => {
    if (videoRef.current && segments.length > 0) {
      const currentTime = videoRef.current.currentTime;

      const activeSegmentIndex = segments.findIndex(
        (segment) => currentTime >= segment.start && currentTime <= segment.end
      );
      setCurrentSegment(activeSegmentIndex >= 0 ? activeSegmentIndex : -1);

      if (wordSegments.length > 0) {
        let foundWord = null;
        let wordWindow: SetStateAction<WordData[]> = [];

        for (let segIndex = 0; segIndex < wordSegments.length; segIndex++) {
          const segment = wordSegments[segIndex];
          if (segment.words && segment.words.length > 0) {
            for (let wordIndex = 0; wordIndex < segment.words.length; wordIndex++) {
              const word = segment.words[wordIndex];
              if (currentTime >= word.start && currentTime <= word.end) {
                foundWord = { segmentIndex: segIndex, wordIndex };

                const wordsBefore = Math.floor(windowSize / 2);
                const wordsAfter = windowSize - wordsBefore - 1;

                let startIndex = Math.max(0, wordIndex - wordsBefore);
                let endIndex = Math.min(segment.words.length, wordIndex + wordsAfter + 1);

                if (endIndex - startIndex < windowSize && segIndex < wordSegments.length - 1) {
                  const nextSegment = wordSegments[segIndex + 1];
                  if (nextSegment?.words) {
                    const additionalWords = nextSegment.words.slice(0, windowSize - (endIndex - startIndex));
                    wordWindow = [
                      ...segment.words.slice(startIndex, endIndex),
                      ...additionalWords,
                    ];
                  } else {
                    wordWindow = segment.words.slice(startIndex, endIndex);
                  }
                } else {
                  wordWindow = segment.words.slice(startIndex, endIndex);
                }
                break;
              }
            }
          }
          if (foundWord) break;
        }

        setCurrentWord(foundWord);
        setCurrentWordWindow(wordWindow);
      }
    }
  };

  const handleSegmentClick = (segmentIndex: number) => {
    if (videoRef.current && segments[segmentIndex]) {
      videoRef.current.currentTime = segments[segmentIndex].start;
      setCurrentSegment(segmentIndex);
    }
  };

  const handleWordClick = (segmentIndex: number, wordIndex: number) => {
    if (videoRef.current && wordSegments[segmentIndex]?.words[wordIndex]) {
      videoRef.current.currentTime = wordSegments[segmentIndex].words[wordIndex].start;
      setCurrentWord({ segmentIndex, wordIndex });
    }
  };

  const handleWordDoubleClick = (segmentIndex: number, wordIndex: number, currentWord: string) => {
    setEditingWord({ segmentIndex, wordIndex });
    setEditedWordValue(currentWord.trim());
  };

  const handleWordEdit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && editingWord) {
      saveWordEdit();
    } else if (e.key === 'Escape') {
      cancelWordEdit();
    }
  };

  const saveWordEdit = () => {
    if (!editingWord || !editedWordValue.trim()) {
      cancelWordEdit();
      return;
    }

    const updatedWordSegments = [...wordSegments];
    if (updatedWordSegments[editingWord.segmentIndex]?.words[editingWord.wordIndex]) {
      updatedWordSegments[editingWord.segmentIndex].words[editingWord.wordIndex].word = " " + editedWordValue.trim();
      
      const segment = updatedWordSegments[editingWord.segmentIndex];
      segment.segment_text = segment.words.map(w => w.word.trim()).join(' ');
      
      setWordSegments(updatedWordSegments);
      
      const newTranscript = updatedWordSegments
        .map(seg => seg.words.map(w => w.word.trim()).join(' '))
        .join(' ');
      setTranscript(newTranscript);
    }

    setEditingWord(null);
    setEditedWordValue("");
  };

  const cancelWordEdit = () => {
    setEditingWord(null);
    setEditedWordValue("");
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setError("");
    setTranscript("");
    setSegments([]);
    setWordSegments([]);
    setCurrentSegment(-1);
    setCurrentWord(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("https://aiproject-ko-production.up.railway.app/transcribe-with-words", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      setTranscript(data.transcript || "No transcript found");
      setSegments(data.segments || []);
      setWordSegments(data.word_segments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadAdvancedWordKaraoke = async () => {
    if (!file || !file.type.startsWith('video/')) return;

    setIsProcessingVideo(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fontFamily", fontSettings.fontFamily);
    
    const videoFontSize = Math.round(fontSettings.fontSize * 3.5);
    formData.append("fontSize", videoFontSize.toString());
    
    formData.append("textColor", fontSettings.textColor);
    formData.append("useStroke", fontSettings.useStroke.toString());
    formData.append("strokeWidth", fontSettings.strokeWidth.toString());
    formData.append("strokeColor", fontSettings.strokeColor);
    formData.append("backgroundColor", fontSettings.backgroundColor);
    formData.append("borderColor", fontSettings.borderColor);
    formData.append("selectedStyle", selectedStyle);
    formData.append("windowSize", windowSize.toString());
    
    if (wordSegments.length > 0) {
      formData.append("editedWordSegments", JSON.stringify(wordSegments));
    }

    try {
      const res = await fetch("https://aiproject-ko-production.up.railway.app/create-advanced-word-karaoke", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `advanced_word_karaoke_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const handleFileSelect = (selectedFile: File) => {
    const validTypes = ["audio/", "video/"];
    const isValidFile = validTypes.some((type) =>
      selectedFile.type.startsWith(type)
    );

    if (isValidFile) {
      setFile(selectedFile);
      setError("");
      setTranscript("");
      setSegments([]);
      setWordSegments([]);
      setCurrentSegment(-1);
      setCurrentWord(null);
    } else {
      setError("Please select a valid audio or video file");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  const removeFile = () => {
    setFile(null);
    setError("");
    setTranscript("");
    setSegments([]);
    setWordSegments([]);
    setCurrentSegment(-1);
    setCurrentWord(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("video/"))
      return <Video className="w-8 h-8 text-blue-600" />;
    if (type.startsWith("audio/"))
      return <Music className="w-8 h-8 text-purple-600" />;
    return <FileText className="w-8 h-8 text-gray-600" />;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(transcript);
      setShowCopyModal(true);
      setTimeout(() => setShowCopyModal(false), 2000);
    } catch (err) {
      console.error("Failed to copy text:", err);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTextStyle = () => {
    if (fontSettings.useStroke) {
      return {
        color: fontSettings.textColor,
        textShadow: `
          -${fontSettings.strokeWidth}px -${fontSettings.strokeWidth}px 0 ${fontSettings.strokeColor},
          ${fontSettings.strokeWidth}px -${fontSettings.strokeWidth}px 0 ${fontSettings.strokeColor},
          -${fontSettings.strokeWidth}px ${fontSettings.strokeWidth}px 0 ${fontSettings.strokeColor},
          ${fontSettings.strokeWidth}px ${fontSettings.strokeWidth}px 0 ${fontSettings.strokeColor},
          -${fontSettings.strokeWidth}px 0px 0 ${fontSettings.strokeColor},
          ${fontSettings.strokeWidth}px 0px 0 ${fontSettings.strokeColor},
          0px -${fontSettings.strokeWidth}px 0 ${fontSettings.strokeColor},
          0px ${fontSettings.strokeWidth}px 0 ${fontSettings.strokeColor}
        `
      };
    } else {
      return {
        color: fontSettings.textColor
      };
    }
  };

  const applyCORPStyle = () => {
    setSelectedStyle('CORP');
    setFontSettings({
      fontFamily: 'Aptos Black',
      fontSize: 24,
      textColor: '#FFFFFF',
      useStroke: false,
      strokeWidth: 2,
      strokeColor: '#000000',
      backgroundColor: '#F97316',
      borderColor: '#1E40AF',
    });
  };

  const applyNoBackgroundStyle = () => {
    setSelectedStyle('NoBackground');
    setFontSettings({
      fontFamily: 'Aptos Black',
      fontSize: 24,
      textColor: '#FFFFFF',
      useStroke: true,
      strokeWidth: 3,
      strokeColor: '#000000',
      backgroundColor: 'transparent',
      borderColor: 'transparent',
    });
  };

  const getPreviewText = () => {
    if (currentWordWindow.length > 0) {
      return currentWordWindow.slice(0, windowSize).map(w => w.word.trim()).join(' ');
    }
    if (wordSegments.length > 0 && currentSegment >= 0) {
      const segment = wordSegments[currentSegment];
      if (segment?.words) {
        return segment.words.slice(0, windowSize).map(w => w.word.trim()).join(' ');
      }
    }
    return "Sample karaoke text preview";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-white rounded-full shadow-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">AI Karaoke Transcriber</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Transform your audio and video files into subtitled videos with customizable word display
          </p>
        </div>

        <div
          className={`
            relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 cursor-pointer
            ${
              isDragOver
                ? "border-blue-500 bg-blue-50 shadow-lg scale-[1.02]"
                : file
                ? "border-green-500 bg-green-50 shadow-md"
                : "border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50 shadow-sm hover:shadow-md"
            }
            ${isLoading || isProcessingVideo ? "pointer-events-none opacity-75" : ""}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={openFileDialog}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,video/*"
            onChange={handleFileInputChange}
            className="hidden"
            disabled={isLoading || isProcessingVideo}
          />

          {!file ? (
            <div className="space-y-6">
              <div className="flex justify-center">
                {isDragOver ? (
                  <Upload className="w-16 h-16 text-blue-600 animate-bounce" />
                ) : (
                  <Upload className="w-16 h-16 text-gray-400" />
                )}
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {isDragOver ? "Drop your file here" : "Upload your media file"}
                </h3>
                <p className="text-gray-600 mb-4">
                  Drag and drop or{" "}
                  <span className="text-blue-600 font-semibold">
                    click to browse
                  </span>
                </p>
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <Video className="w-4 h-4" />
                    <span>MP4</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Music className="w-4 h-4" />
                    <span>MP3</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-center space-x-4">
                {getFileIcon(file.type)}
                <div className="text-left">
                  <p className="font-semibold text-gray-900 truncate max-w-xs text-lg">
                    {file.name}
                  </p>
                  <p className="text-gray-500">{formatFileSize(file.size)}</p>
                </div>
              </div>

              {!isLoading && !isProcessingVideo && (
                <div className="flex justify-center space-x-4 flex-wrap gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload();
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center space-x-2 shadow-md hover:shadow-lg"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Get Word-Level Transcript</span>
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center space-x-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remove</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {(isLoading || isProcessingVideo) && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isLoading ? "Transcribing with word timestamps..." : "Creating karaoke video..."}
                </h3>
                <p className="text-gray-600 mb-1">
                  {isLoading 
                    ? `AI is processing ${file?.type?.includes("video") ? "video" : "audio"} with word-level precision`
                    : "Applying your custom styling and generating video..."
                  }
                </p>
                <p className="text-sm text-gray-500">
                  This may take a few minutes
                </p>
              </div>

              <div className="w-64 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse w-2/3"></div>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <div>
                <h3 className="font-semibold text-red-900">Error</h3>
                <pre className="text-red-700 whitespace-pre-wrap">{error}</pre>
              </div>
            </div>
          </div>
        )}

        {segments.length > 0 && file && file.type.startsWith("video/") && videoUrl && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-purple-900 text-white p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center space-x-3">
                  <Video className="w-6 h-6 text-purple-300" />
                  <span>Video Preview with Live Captions</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {file?.type.startsWith('video/') && (
                    <button
                      onClick={handleDownloadAdvancedWordKaraoke}
                      disabled={isProcessingVideo}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm font-semibold"
                    >
                      {isProcessingVideo ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>Download Karaoke Video</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="relative">
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full rounded-xl shadow-md"
                  style={{ maxHeight: "500px" }}
                  onTimeUpdate={handleTimeUpdate}
                />
                
                {file && file.type.startsWith("video/") && videoUrl && wordSegments.length > 0 && currentSegment >= 0 && (
                  <div className="absolute bottom-4 left-0 right-0 text-center px-4">
                    <div 
                      className="inline-block px-6 py-4 rounded-lg"
                      style={{ 
                        fontFamily: availableFonts.find(f => f.name === fontSettings.fontFamily)?.value || 'sans-serif',
                        fontSize: `${fontSettings.fontSize}px`,
                        backgroundColor: fontSettings.backgroundColor,
                        border: `4px solid ${fontSettings.borderColor}`,
                        fontWeight: 'bold',
                        ...getTextStyle(),
                      }}
                    >
                      {getPreviewText()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {transcript && !isLoading && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gray-900 text-white p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span>Caption Styling & Transcript</span>
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={handleCopyText}
                    className="bg-white bg-opacity-10 hover:bg-opacity-20 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b p-6">
              <div className="flex items-center space-x-4 mb-6">
                <Maximize2 className="w-6 h-6 text-orange-600" />
                <h3 className="text-xl font-semibold text-gray-800">Words Display Limit</h3>
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Maximum words on screen: <span className="text-orange-600 font-bold text-lg">{windowSize} {windowSize === 1 ? 'word' : 'words'}</span>
                </label>
                <div className="space-y-4">
                  <div 
                    className="p-6 rounded-lg border-2 border-gray-200 bg-gray-800"
                  >
                    <div 
                      className="text-center"
                      style={{ 
                        fontFamily: availableFonts.find(f => f.name === fontSettings.fontFamily)?.value || 'sans-serif',
                        fontSize: `${fontSettings.fontSize}px`,
                        fontWeight: fontSettings.fontFamily === 'Aptos Black' ? 'bold' : 'normal',
                        color: fontSettings.textColor,
                      }}
                    >
                      {Array.from({length: windowSize}, (_, i) => `Word${i+1}`).join(' ')}
                    </div>
                    <p className="text-center text-xs text-gray-400 mt-2">
                      Preview: {windowSize} {windowSize === 1 ? 'word' : 'words'} will appear at once
                    </p>
                  </div>
                  
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={windowSize}
                    onChange={(e) => setWindowSize(parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1 word</span>
                    <span>5 words</span>
                    <span>10 words</span>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>💡 Tip:</strong> Fewer words (1-3) create a TikTok/Reels style effect. More words (6-10) show more context like traditional karaoke.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-b p-6">
              <div className="flex items-center space-x-4 mb-6">
                <Type className="w-6 h-6 text-blue-600" />
                <h3 className="text-xl font-semibold text-gray-800">Caption Style Settings</h3>
                <Palette className="w-5 h-5 text-purple-600" />
              </div>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Select Style
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={applyCORPStyle}
                    className={`
                      px-4 py-2 rounded-lg border-2 transition-all duration-200
                      ${selectedStyle === 'CORP' ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white hover:border-blue-300'}
                    `}
                  >
                    CORP Style
                  </button>
                  <button
                    onClick={applyNoBackgroundStyle}
                    className={`
                      px-4 py-2 rounded-lg border-2 transition-all duration-200
                      ${selectedStyle === 'NoBackground' ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-gray-200 bg-white hover:border-blue-300'}
                    `}
                  >
                    No Background
                  </button>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Font Family
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {availableFonts.map((font) => (
                    <button
                      key={font.name}
                      onClick={() => setFontSettings(prev => ({ ...prev, fontFamily: font.name }))}
                      className={`
                        p-3 rounded-lg border-2 transition-all duration-200 text-left
                        ${fontSettings.fontFamily === font.name 
                          ? 'border-blue-500 bg-blue-50 text-blue-900' 
                          : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50'
                        }
                      `}
                      style={{ 
                        fontFamily: font.value,
                        fontWeight: font.name === 'Aptos Black' ? 'bold' : 'normal'
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{font.name}</span>
                        <span className="text-sm text-gray-500" style={{ fontFamily: font.value }}>
                          Sample Text
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Font Size: <span className="text-blue-600 font-bold">{fontSettings.fontSize}px</span>
                </label>
                <div className="space-y-4">
                  <div 
                    className={`p-6 rounded-lg border-2 border-gray-200 ${
                      fontSettings.useStroke ? 'bg-gray-800' : 'bg-white'
                    }`}
                  >
                    <div 
                      style={{ 
                        fontFamily: availableFonts.find(f => f.name === fontSettings.fontFamily)?.value || 'sans-serif',
                        fontSize: `${fontSettings.fontSize}px`,
                        fontWeight: fontSettings.fontFamily === 'Aptos Black' ? 'bold' : 'normal',
                        ...getTextStyle()
                      }}
                    >
                      Preview: Karaoke caption style
                    </div>
                  </div>
                  
                  <input
                    type="range"
                    min="12"
                    max="48"
                    step="1"
                    value={fontSettings.fontSize}
                    onChange={(e) => setFontSettings(prev => ({ ...prev, fontSize: parseInt(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Small (12px)</span>
                    <span>Medium (30px)</span>
                    <span>Large (48px)</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 p-4 bg-white rounded-lg border-2 border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-4 flex items-center space-x-2">
                  <Palette className="w-4 h-4" />
                  <span>Text Color</span>
                </h4>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={fontSettings.textColor}
                    onChange={(e) => setFontSettings(prev => ({ ...prev, textColor: e.target.value }))}
                    className="w-16 h-16 rounded-lg border-2 border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={fontSettings.textColor}
                      onChange={(e) => setFontSettings(prev => ({ ...prev, textColor: e.target.value }))}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg text-sm font-mono uppercase"
                      placeholder="#FFFFFF"
                    />
                    <p className="text-xs text-gray-500 mt-1">Main caption text color</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Caption Background Style
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setFontSettings(prev => ({ ...prev, useStroke: false }))}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${!fontSettings.useStroke 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white hover:border-blue-300'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className="bg-black bg-opacity-90 text-white px-4 py-2 rounded text-sm">
                        Sample Text
                      </div>
                      <span className="text-sm font-medium text-gray-700">Black Background Box</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setFontSettings(prev => ({ ...prev, useStroke: true }))}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${fontSettings.useStroke 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 bg-white hover:border-blue-300'
                      }
                    `}
                  >
                    <div className="flex flex-col items-center space-y-2">
                      <div className="bg-gray-700 px-4 py-2 rounded">
                        <span 
                          className="text-white text-sm"
                          style={{
                            textShadow: '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000'
                          }}
                        >
                          Sample Text
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">Text Stroke/Outline</span>
                    </div>
                  </button>
                </div>
              </div>

              {fontSettings.useStroke && (
                <div className="p-4 bg-white rounded-lg border-2 border-gray-200">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">Outline Settings</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-gray-600 mb-2">
                        Outline Width: <span className="font-bold text-blue-600">{fontSettings.strokeWidth}px</span>
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="5"
                        step="0.5"
                        value={fontSettings.strokeWidth}
                        onChange={(e) => setFontSettings(prev => ({ ...prev, strokeWidth: parseFloat(e.target.value) }))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-600 mb-2">
                        Outline Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={fontSettings.strokeColor}
                          onChange={(e) => setFontSettings(prev => ({ ...prev, strokeColor: e.target.value }))}
                          className="w-12 h-12 rounded border-2 border-gray-300 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={fontSettings.strokeColor}
                          onChange={(e) => setFontSettings(prev => ({ ...prev, strokeColor: e.target.value }))}
                          className="flex-1 px-3 py-2 border-2 border-gray-300 rounded text-sm font-mono uppercase"
                          placeholder="#000000"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-6">
              <div className="w-full space-y-4">
                {wordSegments.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto" ref={transcriptRef}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">Word-by-Word Interactive Transcript</h3>
                      <p className="text-sm text-gray-500">Click to jump • Double-click to edit</p>
                    </div>
                    <div className="space-y-4">
                      {wordSegments.map((segment, segmentIndex) => (
                        <div 
                          key={segmentIndex} 
                          className={`
                            p-4 rounded-lg border transition-all duration-300
                            ${segmentIndex === currentSegment 
                              ? 'bg-purple-50 border-purple-200 shadow-md' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                            }
                          `}
                        >
                          <div className="flex items-center mb-2">
                            <span className="text-xs text-gray-500 font-mono bg-gray-200 px-2 py-1 rounded">
                              {formatTime(segment.segment_start)}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-1 leading-relaxed"
                               style={{ 
                                 fontFamily: availableFonts.find(f => f.name === fontSettings.fontFamily)?.value || 'sans-serif',
                                 fontSize: `${Math.min(fontSettings.fontSize, 18)}px`,
                                 fontWeight: fontSettings.fontFamily === 'Aptos Black' ? 'bold' : 'normal'
                               }}>
                            {segment.words && segment.words.length > 0 ? (
                              segment.words.map((word, wordIndex) => {
                                const isCurrentWord = currentWord?.segmentIndex === segmentIndex && currentWord?.wordIndex === wordIndex;
                                const isInCurrentSegment = segmentIndex === currentSegment;
                                const isEditing = editingWord?.segmentIndex === segmentIndex && editingWord?.wordIndex === wordIndex;
                                
                                if (isEditing) {
                                  return (
                                    <input
                                      key={wordIndex}
                                      type="text"
                                      value={editedWordValue}
                                      onChange={(e) => setEditedWordValue(e.target.value)}
                                      onKeyDown={handleWordEdit}
                                      onBlur={saveWordEdit}
                                      autoFocus
                                      className="px-2 py-1 border-2 border-blue-500 rounded bg-white text-gray-900 font-medium outline-none"
                                      style={{
                                        width: `${Math.max(50, editedWordValue.length * 10)}px`,
                                        fontFamily: availableFonts.find(f => f.name === fontSettings.fontFamily)?.value || 'sans-serif',
                                        fontSize: `${Math.min(fontSettings.fontSize, 18)}px`,
                                        fontWeight: fontSettings.fontFamily === 'Aptos Black' ? 'bold' : 'normal'
                                      }}
                                    />
                                  );
                                }
                                
                                return (
                                  <span
                                    key={wordIndex}
                                    className={`
                                      cursor-pointer transition-all duration-200 px-1 py-0.5 rounded
                                      ${isCurrentWord 
                                        ? 'bg-yellow-300 text-black font-bold shadow-sm transform scale-105' 
                                        : isInCurrentSegment
                                        ? 'bg-purple-100 text-purple-900 hover:bg-purple-200'
                                        : 'text-gray-800 hover:bg-blue-100 hover:text-blue-900'
                                      }
                                    `}
                                    onClick={() => handleWordClick(segmentIndex, wordIndex)}
                                    onDoubleClick={() => handleWordDoubleClick(segmentIndex, wordIndex, word.word)}
                                    title={`Single click: Jump to ${word.start.toFixed(1)}s | Double click: Edit word`}
                                  >
                                    {word.word}
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-gray-800">{segment.segment_text}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {currentWord && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                          <span className="text-sm text-yellow-800"
                                style={{ 
                                  fontFamily: availableFonts.find(f => f.name === fontSettings.fontFamily)?.value || 'sans-serif',
                                  fontWeight: fontSettings.fontFamily === 'Aptos Black' ? 'bold' : 'normal'
                                }}>
                            Currently speaking: <strong>{wordSegments[currentWord.segmentIndex]?.words[currentWord.wordIndex]?.word}</strong>
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {showCopyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 shadow-xl">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-6 h-6 text-green-500" />
                <p className="text-lg font-semibold">Copied to clipboard!</p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mt-12 text-gray-500">
          <p>Powered by AI Transcription • Secure & Private • Word-Level Precision</p>
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          transition: all 0.2s;
        }
        
        .slider::-webkit-slider-thumb:hover {
          background: #2563EB;
          transform: scale(1.1);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3B82F6;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Poppins:wght@400;700&display=swap');
        
        @font-face {
          font-family: 'Aptos';
          src: local('Aptos'), local('Aptos-Regular');
          font-weight: normal;
          font-style: normal;
        }
        
        @font-face {
          font-family: 'Aptos';
          src: local('Aptos Black'), local('Aptos-Black');
          font-weight: bold;
          font-style: normal;
        }
      `}</style>
    </div>
  );
}