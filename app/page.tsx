"use client";

import { useState, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import DropZone from "@/components/DropZone";
import Sidebar from "@/components/Sidebar";
import { GradeComment } from "@/lib/openai";
import type { FormattedPaper } from "@/lib/semanticScholar";
import type { EditorRef } from "@/components/Editor";

const Editor = dynamic(() => import("@/components/Editor"), { ssr: false });

type AppState = "empty" | "loaded" | "grading" | "graded";

export default function PaperGradePage() {
  const [appState, setAppState] = useState<AppState>("empty");
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [currentText, setCurrentText] = useState("");

  // Streaming grade state — built up progressively
  const [streamedGrade, setStreamedGrade] = useState<string | null>(null);
  const [streamedComments, setStreamedComments] = useState<GradeComment[]>([]);
  const [streamedPapers, setStreamedPapers] = useState<FormattedPaper[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const [activeCommentIndex, setActiveCommentIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<EditorRef>(null);

  // ── File handling ─────────────────────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to extract text.");
      setPendingText(data.text);
      setAppState("loaded");
      setStreamedGrade(null);
      setStreamedComments([]);
      setStreamedPapers([]);
      setActiveCommentIndex(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsExtracting(false);
    }
  }, []);

  // ── Grading (SSE stream) ──────────────────────────────────────────────────

  const handleGrade = useCallback(async () => {
    const text = currentText.trim();
    if (!text) return;

    setError(null);
    setAppState("grading");
    setStreamedGrade(null);
    setStreamedComments([]);
    setStreamedPapers([]);
    setIsStreaming(true);
    editorRef.current?.clearHighlights?.();
    setActiveCommentIndex(null);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Grading failed.");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const incoming: GradeComment[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // last partial line stays in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;

          let event: { type: string; grade?: string; comment?: GradeComment; papers?: FormattedPaper[]; message?: string };
          try { event = JSON.parse(raw); } catch { continue; }

          if (event.type === "papers" && event.papers) {
            setStreamedPapers(event.papers);
          }

          if (event.type === "grade" && event.grade) {
            setStreamedGrade(event.grade);
            setAppState("graded"); // show sidebar immediately with grade
          }

          if (event.type === "comment" && event.comment) {
            incoming.push(event.comment);
            // Spread so React sees a new array reference each time
            setStreamedComments([...incoming]);
            // Apply this highlight immediately
            editorRef.current?.applyHighlights([...incoming]);
          }

          if (event.type === "error" && event.message) {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Grading failed.");
      if (streamedGrade === null) setAppState("loaded");
    } finally {
      setIsStreaming(false);
    }
  }, [currentText, streamedGrade]);

  // ── Re-grade ──────────────────────────────────────────────────────────────

  const handleReGrade = useCallback(() => {
    editorRef.current?.clearHighlights?.();
    setStreamedGrade(null);
    setStreamedComments([]);
    setActiveCommentIndex(null);
    handleGrade();
  }, [handleGrade]);

  // ── Card / highlight interaction ──────────────────────────────────────────

  const handleCardClick = useCallback((index: number) => {
    setActiveCommentIndex(index);
    editorRef.current?.scrollToComment(index);
  }, []);

  const handleHighlightClick = useCallback((commentIndex: number) => {
    setActiveCommentIndex(commentIndex);
    const card = document.querySelector(`[data-card-index="${commentIndex}"]`);
    card?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const hasText = appState !== "empty";
  const isGrading = appState === "grading" || isStreaming;
  const isGraded = appState === "graded";
  const showSidebar = isGraded || appState === "grading";

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-[52px] flex items-center px-6 gap-4">
        <div className="flex-none">
          <span className="text-sm font-semibold text-gray-400 tracking-tight">PaperGrade</span>
        </div>

        <div className="flex-1 flex justify-center">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,.docx"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-all duration-200 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload PDF or DOCX
            </span>
          </label>
        </div>

        <div className="flex-none flex items-center gap-2">
          {isGraded && !isStreaming && (
            <button
              onClick={handleReGrade}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
            >
              Re-Grade
            </button>
          )}
          <button
            onClick={handleGrade}
            disabled={!hasText || isGrading || isExtracting}
            className={`
              px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200
              ${hasText && !isGrading && !isExtracting
                ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm"
                : "bg-blue-200 text-blue-400 cursor-not-allowed"
              }
            `}
          >
            {isGrading ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-blue-300 border-t-transparent rounded-full animate-spin inline-block" />
                Grading…
              </span>
            ) : (
              "Grade My Paper"
            )}
          </button>
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${showSidebar ? "md:mr-80" : ""}`}>
          <div className="max-w-[780px] mx-auto px-6 pb-24 pt-2">
            {error && (
              <div className="mb-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm text-red-700">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}

            {appState === "empty" && (
              <div className="mt-8">
                <DropZone onFile={handleFile} isLoading={isExtracting} />
              </div>
            )}

            <div className={appState === "empty" ? "hidden" : "block"}>
              <Editor
                editorRef={editorRef}
                pendingText={pendingText}
                onTextChange={setCurrentText}
                onHighlightClick={handleHighlightClick}
              />
            </div>
          </div>
        </main>

        {showSidebar && (
          <Sidebar
            grade={streamedGrade}
            comments={streamedComments}
            papers={streamedPapers}
            isStreaming={isStreaming}
            activeIndex={activeCommentIndex}
            onCardClick={handleCardClick}
          />
        )}
      </div>

      {/* ── Mobile bottom sheet ─────────────────────────────────────────────── */}
      {showSidebar && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 max-h-72 overflow-y-auto sidebar-scroll z-20 shadow-2xl">
          <div className="px-4 pt-3 pb-2 flex items-center gap-3 border-b border-gray-100">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">AI Insights</span>
            {streamedGrade && (
              <span className={`text-2xl font-bold ${
                streamedGrade === "A" ? "text-green-600" :
                streamedGrade === "B" ? "text-blue-600" :
                streamedGrade === "C" ? "text-yellow-600" :
                streamedGrade === "D" ? "text-orange-600" : "text-red-600"
              }`}>{streamedGrade}</span>
            )}
            {isStreaming && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-gray-500">{streamedComments.length} annotations…</span>
              </div>
            )}
          </div>
          <div className="flex gap-3 p-3 overflow-x-auto">
            {streamedComments.map((comment, i) => (
              <div
                key={i}
                data-card-index={i}
                onClick={() => handleCardClick(i)}
                className={`flex-shrink-0 w-64 bg-white rounded-lg p-3 border cursor-pointer transition-all duration-200 ${
                  activeCommentIndex === i ? "ring-2 ring-blue-400 border-transparent" : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    comment.highlightColor === "yellow" ? "bg-yellow-400" :
                    comment.highlightColor === "red" ? "bg-red-500" : "bg-green-500"
                  }`} />
                  <span className="text-xs font-semibold text-gray-600">{comment.label}</span>
                </div>
                <p className="text-xs text-gray-600 line-clamp-3">{comment.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
