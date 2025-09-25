"use client";
import { useState, useRef, useEffect } from "react";
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
} from "lucide-react";
import CopyModal from "../app/components/modals/copy";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showCopyModal, setShowCopyModal] = useState<boolean>(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleUpload = async () => {
    if (!file) return;

    setIsLoading(true);
    setError("");
    setTranscript("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/transcribe", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      setTranscript(data.transcript || "No transcript found");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="p-3 bg-white rounded-full shadow-lg">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-4xl font-bold text-gray-900">AI Transcriber</h1>
          </div>
          <p className="text-gray-600 text-lg">
            Transform your audio and video files into text with AI precision
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
            ${isLoading ? "pointer-events-none opacity-75" : ""}
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
            disabled={isLoading}
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

              {!isLoading && (
                <div className="flex justify-center space-x-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload();
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center space-x-2 shadow-md hover:shadow-lg"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Start Transcription</span>
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

        {/* Loading State */}
        {isLoading && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg p-8">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Processing your file...
                </h3>
                <p className="text-gray-600 mb-1">
                  AI is transcribing your{" "}
                  {file?.type?.includes("video") ? "video" : "audio"} content
                </p>
                <p className="text-sm text-gray-500">
                  This may take a few moments depending on file size
                </p>
              </div>

              {/* Progress indicator */}
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
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Transcript Result */}
        {transcript && !isLoading && (
          <div className="mt-8 bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gray-900 text-white p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold flex items-center space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400" />
                  <span>Transcription Complete</span>
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
              <div className="flex flex-col md:flex-row gap-6">
                {file && file.type.startsWith("video/") && videoUrl && (
                  <div className="md:w-1/2">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full rounded-xl shadow-md"
                      style={{ maxHeight: "384px" }}
                    />
                  </div>
                )}
                <div
                  className={`${
                    file && file.type.startsWith("video/") ? "md:w-1/2" : "w-full"
                  } bg-gray-50 rounded-xl p-6 max-h-96 overflow-y-auto`}
                >
                  <pre className="whitespace-pre-wrap text-gray-900 leading-relaxed font-sans">
                    {transcript}
                  </pre>
                </div>
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
          <p>Powered by Kurt Pogi • Secure & Private • Lightning Fast</p>
        </div>
      </div>
    </div>
  );
}