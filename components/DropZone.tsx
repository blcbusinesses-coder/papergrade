"use client";

import { useCallback, useState } from "react";

interface DropZoneProps {
  onFile: (file: File) => void;
  isLoading: boolean;
}

export default function DropZone({ onFile, isLoading }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        flex flex-col items-center justify-center
        w-full min-h-[420px] rounded-xl border-2 border-dashed
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
          <p className="text-sm text-gray-500 font-sans">Extracting text...</p>
        </div>
      ) : (
        <label className="flex flex-col items-center gap-4 cursor-pointer w-full h-full justify-center">
          <input
            type="file"
            accept=".pdf,.docx"
            className="sr-only"
            onChange={handleInputChange}
          />
          {/* Upload icon */}
          <div className={`transition-colors duration-200 ${isDragOver ? "text-blue-500" : "text-gray-400"}`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="52"
              height="52"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="text-center">
            <p className={`text-lg font-medium transition-colors duration-200 ${isDragOver ? "text-blue-600" : "text-gray-700"}`}>
              {isDragOver ? "Release to upload" : "Drop your paper here"}
            </p>
            <p className="text-sm text-gray-400 mt-1">Supports PDF and DOCX</p>
            <p className="text-xs text-gray-400 mt-3">
              or{" "}
              <span className="text-blue-500 underline underline-offset-2">
                click to browse
              </span>
            </p>
          </div>
        </label>
      )}
    </div>
  );
}
