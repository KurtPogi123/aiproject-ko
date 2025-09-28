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
} from "lucide-react";
import CopyModal from "../app/components/modals/copy";

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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [segments, setSegments] = useState<any[]>([]);
  const [wordSegments, setWordSegments] = useState<WordSegment[]>([]); // NEW
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [srtContent, setSrtContent] = useState<string>("");
  const [currentSegment, setCurrentSegment] = useState<number>(-1);
  const [currentWord, setCurrentWord] = useState<{ segmentIndex: number; wordIndex: number } | null>(null); // NEW
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Create and clean up video URL
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

  const [currentWordWindow, setCurrentWordWindow] = useState<WordData[]>([]);

  // UPDATED: Enhanced time update handler for word-level highlighting
  const handleTimeUpdate = () => {
    if (videoRef.current && segments.length > 0) {
      const currentTime = videoRef.current.currentTime;

      // Find current segment
      const activeSegmentIndex = segments.findIndex(
        (segment) => currentTime >= segment.start && currentTime <= segment.end
      );
      setCurrentSegment(activeSegmentIndex);

      // Find current word and create a window of 5-6 words
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

                // Create a window of 5-6 words centered around the current word
                const windowSize = 6; // Target 5-6 words
                const wordsBefore = Math.floor(windowSize / 2); // e.g., 3 words before
                const wordsAfter = windowSize - wordsBefore - 1; // e.g., 2 words after

                // Calculate start and end indices for the window
                let startIndex = Math.max(0, wordIndex - wordsBefore);
                let endIndex = Math.min(segment.words.length, wordIndex + wordsAfter + 1);

                // Adjust if we don't have enough words in the current segment
                if (endIndex - startIndex < windowSize && segIndex < wordSegments.length - 1) {
                  // Try to pull words from the next segment
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

  // Click to seek function
  const handleSegmentClick = (segmentIndex: number) => {
    if (videoRef.current && segments[segmentIndex]) {
      videoRef.current.currentTime = segments[segmentIndex].start;
      setCurrentSegment(segmentIndex);
    }
  };

  // NEW: Click word to seek
  const handleWordClick = (segmentIndex: number, wordIndex: number) => {
    if (videoRef.current && wordSegments[segmentIndex]?.words[wordIndex]) {
      videoRef.current.currentTime = wordSegments[segmentIndex].words[wordIndex].start;
      setCurrentWord({ segmentIndex, wordIndex });
    }
  };

  // UPDATED: Use word-level transcription endpoint
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

      const res = await fetch("http://localhost:8000/transcribe-with-words", {
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

  const handleCreateSubtitledVideo = async () => {
    if (!file) return;

    setIsProcessingVideo(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/transcribe-with-video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        setTranscript(data.transcript || "No transcript found");
        setSegments(data.segments || []);
        setSrtContent(data.srt_content || "");
      } else {
        throw new Error(data.error || "Failed to create karaoke data");
      }
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create karaoke data");
    } finally {
      setIsProcessingVideo(false);
    }
  };

  const handleDownloadSRT = () => {
    if (!srtContent || !file) return;
    
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${file.name.replace(/\.[^/.]+$/, "")}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadKaraokeVideo = async () => {
    if (!file || !file.type.startsWith('video/')) return;

    setIsProcessingVideo(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/create-karaoke-video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        if (errorData.error === "FFmpeg not available") {
          setError(`${errorData.message}\n\nInstructions:\n${errorData.instructions.join('\n')}\n\n${errorData.alternative}`);
        } else {
          throw new Error(errorData.error || `Server error: ${res.status}`);
        }
        return;
      }

      const videoBlob = await res.blob();
      
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `karaoke_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create karaoke video");
    } finally {
      setIsProcessingVideo(false);
    }
  };

  // NEW: Word-level karaoke video download
  const handleDownloadWordKaraokeVideo = async () => {
    if (!file || !file.type.startsWith('video/')) return;

    setIsProcessingVideo(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/create-word-level-karaoke-video", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const videoBlob = await res.blob();
      
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `word_karaoke_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create word-level karaoke video");
    } finally {
      setIsProcessingVideo(false);
    }
  };

  // NEW: Advanced word karaoke video download
  const handleDownloadAdvancedWordKaraoke = async () => {
    if (!file || !file.type.startsWith('video/')) return;

    setIsProcessingVideo(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/create-advanced-word-karaoke", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }

      const videoBlob = await res.blob();
      
      const url = URL.createObjectURL(videoBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `advanced_word_karaoke_${file.name}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create advanced word karaoke video");
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
      setSrtContent("");
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
    setSrtContent("");
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-white rounded-full shadow-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">AI Karaoke Transcriber</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Transform your audio and video files into subtitled videos with word-level highlighting
          </p>
        </div>

        {/* Drag & Drop Area */}
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

        {/* Loading States */}
        {(isLoading || isProcessingVideo) && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {isLoading ? "Transcribing with word timestamps..." : "Creating Video data..."}
                </h3>
                <p className="text-gray-600 mb-1">
                  {isLoading 
                    ? `AI is processing ${file?.type?.includes("video") ? "video" : "audio"} with word-level precision`
                    : "Processing timing information for Video mode..."
                  }
                </p>
                <p className="text-sm text-gray-500">
                  Word-level processing takes longer but provides precise highlighting
                </p>
              </div>

              <div className="w-64 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-pulse w-2/3"></div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
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

        {/* Karaoke Video with Live Captions */}
        {segments.length > 0 && file && file.type.startsWith("video/") && videoUrl && (
      <div className="mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="bg-purple-900 text-white p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold flex items-center space-x-3">
              <Video className="w-6 h-6 text-purple-300" />
              <span>Video with Word-Level Captions</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {file?.type.startsWith('video/') && (
                <>
                  <button
                    onClick={handleDownloadAdvancedWordKaraoke}
                    disabled={isProcessingVideo}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 px-3 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm"
                  >
                    {isProcessingVideo ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span>Download</span>
                  </button>
                </>
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
            
            {/* UPDATED: Live Caption Overlay with Word Window */}
            {currentSegment >= 0 && segments[currentSegment] && currentWordWindow.length > 0 && (
              <div className="absolute bottom-20 left-0 right-0 text-center px-4">
                <div className="inline-block bg-black bg-opacity-90 text-white px-6 py-4 rounded-lg text-lg font-semibold max-w-5xl">
                  <div className="flex flex-wrap justify-center gap-1">
                    {currentWordWindow.map((word, index) => {
                      const isCurrentWord = currentWord && wordSegments[currentWord.segmentIndex]?.words[currentWord.wordIndex]?.word === word.word;
                      return (
                        <span
                          key={index}
                          className={`transition-all duration-200 ${
                            isCurrentWord
                              ? 'bg-yellow-400 text-black px-1 rounded transform scale-110'
                              : 'text-white'
                          }`}
                        >
                          {word.word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

        {/* Word-Level Transcript with Highlighting */}
        {transcript && !isLoading && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gray-900 text-white p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span>Word-Level Interactive Transcript</span>
                </h2>
                <div className="flex space-x-3">
                  <button
                    onClick={handleCopyText}
                    className="bg-opacity-10 hover:bg-opacity-20 px-4 py-2 rounded-lg transition-colors flex items-center space-x-2"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="w-full space-y-4">
                {/* Word-Level Interactive Transcript */}
                {wordSegments.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-4 max-h-96 overflow-y-auto" ref={transcriptRef}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800">Word-by-Word Transcript</h3>
                      <p className="text-sm text-gray-500">Click any word to jump to that moment</p>
                    </div>
                    <div className="space-y-4">
                      {wordSegments.map((segment, segmentIndex) => (
                        <div 
                          key={segmentIndex} 
                          data-segment-index={segmentIndex}
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
                          
                          {/* Word-by-word rendering */}
                          <div className="flex flex-wrap gap-1 leading-relaxed">
                            {segment.words && segment.words.length > 0 ? (
                              segment.words.map((word, wordIndex) => {
                                const isCurrentWord = currentWord?.segmentIndex === segmentIndex && currentWord?.wordIndex === wordIndex;
                                const isInCurrentSegment = segmentIndex === currentSegment;
                                
                                return (
                                  <span
                                    key={wordIndex}
                                    className={`
                                      cursor-pointer transition-all duration-200 px-1 py-0.5 rounded text-base
                                      ${isCurrentWord 
                                        ? 'bg-yellow-300 text-black font-bold shadow-sm transform scale-105' 
                                        : isInCurrentSegment
                                        ? 'bg-purple-100 text-purple-900 hover:bg-purple-200'
                                        : 'text-gray-800 hover:bg-blue-100 hover:text-blue-900'
                                      }
                                    `}
                                    onClick={() => handleWordClick(segmentIndex, wordIndex)}
                                    title={`${word.start.toFixed(1)}s - ${word.end.toFixed(1)}s`}
                                  >
                                    {word.word}
                                  </span>
                                );
                              })
                            ) : (
                              // Fallback for segments without word data
                              <span className="text-gray-800">{segment.segment_text}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Current word indicator */}
                    {currentWord && (
                      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                          <span className="text-sm text-yellow-800">
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

        {/* Copy Success Modal */}
        <CopyModal
          isOpen={showCopyModal}
          onClose={() => setShowCopyModal(false)}
        />

        {/* Footer */}
        <div className="text-center mt-12 text-gray-500">
          <p>Powered by Kurt Pogi • Secure & Private • Word-Level Precision</p>
        </div>
      </div>
    </div>
  );
}