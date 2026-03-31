"use client";

import { useCallback, useState } from "react";

interface DropZoneProps {
  onFile: (file: File) => void;
  onUrl: (url: string) => void;
  isLoading: boolean;
}

export default function DropZone({ onFile, onUrl, isLoading }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [docUrl, setDocUrl] = useState("");
  const [urlError, setUrlError] = useState("");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  const handleUrlSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = docUrl.trim();
      if (!trimmed) return;
      if (!trimmed.includes("docs.google.com/document")) {
        setUrlError("Please enter a valid Google Docs URL.");
        return;
      }
      setUrlError("");
      onUrl(trimmed);
    },
    [docUrl, onUrl]
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          flex flex-col items-center justify-center
          w-full min-h-[200px] sm:min-h-[340px] rounded-xl border-2 border-dashed
          transition-all duration-200 ease-in-out cursor-pointer select-none
          ${isDragOver
            ? "border-blue-400 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
          }
        `}
      >
        {isLoading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Extracting text...</p>
          </div>
        ) : (
          <label className="flex flex-col items-center gap-3 cursor-pointer w-full h-full justify-center px-6">
            <input
              type="file"
              accept=".pdf,.docx"
              className="sr-only"
              onChange={handleInputChange}
            />
            <div className={`transition-colors duration-200 ${isDragOver ? "text-blue-500" : "text-gray-400"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </div>
            <div className="text-center">
              <p className={`text-base sm:text-lg font-medium transition-colors duration-200 ${isDragOver ? "text-blue-600" : "text-gray-700"}`}>
                {isDragOver ? "Release to upload" : "Drop your paper here"}
              </p>
              <p className="text-sm text-gray-400 mt-1">PDF or DOCX</p>
              <p className="text-xs text-gray-400 mt-2">
                or <span className="text-blue-500 underline underline-offset-2">tap to browse</span>
              </p>
            </div>
          </label>
        )}
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs text-gray-400 font-medium">or paste a link</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {/* Google Docs URL input */}
      <form onSubmit={handleUrlSubmit} className="flex gap-2">
        <div className="flex-1 relative">
          {/* Google Docs icon */}
          <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4285F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </span>
          <input
            type="url"
            value={docUrl}
            onChange={(e) => { setDocUrl(e.target.value); setUrlError(""); }}
            placeholder="Paste public Google Docs URL…"
            disabled={isLoading}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent placeholder:text-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading || !docUrl.trim()}
          className="px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-200 disabled:cursor-not-allowed transition-colors duration-150 whitespace-nowrap"
        >
          Import
        </button>
      </form>
      {urlError && <p className="text-xs text-red-500 -mt-2">{urlError}</p>}
    </div>
  );
}
