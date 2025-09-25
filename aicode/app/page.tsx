"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState<string>("");

  const handleUpload = async () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    // Send file to your Python backend
    const res = await fetch("http://localhost:8000/transcribe", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setTranscript(data.transcript || "No transcript found");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-10 bg-gray-100">
      <h1 className="text-2xl font-bold mb-6">🎤 Video/Audio Transcriber</h1>

      <input
        type="file"
        accept="audio/*,video/*"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400"
        disabled={!file}
      >
        Upload & Transcribe
      </button>

      {transcript && (
        <div className="mt-6 w-full max-w-2xl bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Transcript:</h2>
          <pre className="whitespace-pre-wrap">{transcript}</pre>
        </div>
      )}
    </div>
  );
}
