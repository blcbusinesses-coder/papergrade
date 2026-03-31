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

const GRADE_COLOR: Record<string, string> = {
  A: "text-green-600", B: "text-blue-600", C: "text-yellow-600",
  D: "text-orange-600", F: "text-red-600",
};

export default function PaperGradePage() {
  const [appState, setAppState] = useState<AppState>("empty");
  const [isExtracting, setIsExtracting] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [currentText, setCurrentText] = useState("");

  const [streamedGrade, setStreamedGrade] = useState<string | null>(null);
  const [streamedComments, setStreamedComments] = useState<GradeComment[]>([]);
  const [streamedPapers, setStreamedPapers] = useState<FormattedPaper[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const [activeCommentIndex, setActiveCommentIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const editorRef = useRef<EditorRef | null>(null);

  // ── File handling ─────────────────────────────────────────────────────────

  const applyExtractedText = useCallback((text: string) => {
    setPendingText(text);
    setAppState("loaded");
    setStreamedGrade(null);
    setStreamedComments([]);
    setStreamedPapers([]);
    setActiveCommentIndex(null);
    setDrawerOpen(false);
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to extract text.");
      applyExtractedText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsExtracting(false);
    }
  }, [applyExtractedText]);

  const handleUrl = useCallback(async (url: string) => {
    setError(null);
    setIsExtracting(true);
    try {
      const res = await fetch("/api/extract-gdoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch Google Doc.");
      applyExtractedText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch Google Doc.");
    } finally {
      setIsExtracting(false);
    }
  }, [applyExtractedText]);

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
    setDrawerOpen(false);
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
        buffer = lines.pop() ?? "";

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
            setAppState("graded");
            setDrawerOpen(true); // auto-open drawer when grade arrives
          }

          if (event.type === "comment" && event.comment) {
            incoming.push(event.comment);
            setStreamedComments([...incoming]);
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

  const handleReGrade = useCallback(() => {
    editorRef.current?.clearHighlights?.();
    setStreamedGrade(null);
    setStreamedComments([]);
    setActiveCommentIndex(null);
    handleGrade();
  }, [handleGrade]);

  const handleCardClick = useCallback((index: number) => {
    setActiveCommentIndex(index);
    editorRef.current?.scrollToComment(index);
    setDrawerOpen(false); // close drawer so the highlight is visible
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
  const g = streamedGrade?.toUpperCase() ?? "";

  return (
    <div className="flex flex-col h-screen bg-white">

      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white border-b border-gray-200 h-[52px] flex items-center px-3 sm:px-6 gap-2 sm:gap-4">

        {/* Logo */}
        <div className="flex-none">
          <span className="text-sm font-semibold text-gray-400 tracking-tight">PaperGrade</span>
        </div>

        {/* Upload — icon only on mobile, full label on sm+ */}
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
            <span className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:border-gray-400 hover:text-gray-800 hover:bg-gray-50 transition-all duration-200 select-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span className="hidden sm:inline">Upload PDF or DOCX</span>
              <span className="sm:hidden">Upload</span>
            </span>
          </label>
        </div>

        {/* Action buttons */}
        <div className="flex-none flex items-center gap-1.5 sm:gap-2">
          {isGraded && !isStreaming && (
            <button
              onClick={handleReGrade}
              className="hidden sm:block px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all duration-200"
            >
              Re-Grade
            </button>
          )}
          <button
            onClick={handleGrade}
            disabled={!hasText || isGrading || isExtracting}
            className={`
              px-3 sm:px-4 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200
              ${hasText && !isGrading && !isExtracting
                ? "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-sm"
                : "bg-blue-200 text-blue-400 cursor-not-allowed"
              }
            `}
          >
            {isGrading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-blue-300 border-t-transparent rounded-full animate-spin inline-block" />
                <span className="hidden sm:inline">Grading…</span>
              </span>
            ) : (
              <>
                <span className="hidden sm:inline">Grade My Paper</span>
                <span className="sm:hidden">Grade</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        <main className={`flex-1 overflow-y-auto transition-all duration-300 ${showSidebar ? "md:mr-80" : ""}`}>
          <div className="max-w-[780px] mx-auto px-3 sm:px-6 pb-28 md:pb-24 pt-2">

            {error && (
              <div className="mb-4 mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p className="text-sm text-red-700">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )}

            {appState === "empty" && (
              <div className="mt-6 sm:mt-8">
                <DropZone onFile={handleFile} onUrl={handleUrl} isLoading={isExtracting} />
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

      {/* ── Mobile collapsible drawer ─────────────────────────────────────────
           Hidden on md+ (desktop uses the sidebar instead)                    */}
      {showSidebar && (
        <div className={`
          md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200
          z-20 shadow-2xl transition-all duration-300 ease-in-out flex flex-col
          ${drawerOpen ? "max-h-[72vh]" : "max-h-[60px]"}
        `}>

          {/* Drawer handle — always visible, tap to toggle */}
          <button
            onClick={() => setDrawerOpen((o) => !o)}
            className="flex-none w-full h-[60px] flex items-center justify-between px-4 gap-3"
            aria-label={drawerOpen ? "Collapse annotations" : "Expand annotations"}
          >
            {/* Left: grade badge + status */}
            <div className="flex items-center gap-3 min-w-0">
              {streamedGrade ? (
                <span className={`text-2xl font-bold leading-none ${GRADE_COLOR[g] ?? "text-gray-700"}`}>
                  {g}
                </span>
              ) : (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              )}
              <span className="text-sm text-gray-500 truncate">
                {isStreaming
                  ? `${streamedComments.length} annotations loading…`
                  : `${streamedComments.length} annotation${streamedComments.length !== 1 ? "s" : ""}`}
              </span>
            </div>

            {/* Right: chevron */}
            <svg
              xmlns="http://www.w3.org/2000/svg" width="16" height="16"
              viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`flex-shrink-0 text-gray-400 transition-transform duration-300 ${drawerOpen ? "rotate-180" : ""}`}
            >
              <polyline points="18 15 12 9 6 15"/>
            </svg>
          </button>

          {/* Scrollable annotation list */}
          {drawerOpen && (
            <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll px-4 pb-6 flex flex-col gap-3">
              {/* Re-grade button on mobile */}
              {isGraded && !isStreaming && (
                <button
                  onClick={() => { setDrawerOpen(false); handleReGrade(); }}
                  className="w-full py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Re-Grade
                </button>
              )}

              {streamedComments.map((comment, i) => {
                const color = comment.highlightColor ?? "yellow";
                const borderColor = color === "green" ? "border-l-green-500" : color === "red" ? "border-l-red-400" : "border-l-yellow-400";
                const dotColor = color === "green" ? "bg-green-500" : color === "red" ? "bg-red-400" : "bg-yellow-400";
                const labelBg = color === "green" ? "bg-green-50 text-green-700" : color === "red" ? "bg-red-50 text-red-700" : "bg-yellow-50 text-yellow-700";
                return (
                  <button
                    key={i}
                    data-card-index={i}
                    onClick={() => handleCardClick(i)}
                    className={`w-full text-left bg-white rounded-lg border border-gray-100 border-l-4 ${borderColor} p-3 shadow-sm active:bg-gray-50 ${activeCommentIndex === i ? "ring-2 ring-blue-400" : ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${labelBg}`}>{comment.label}</span>
                    </div>
                    {comment.snippet && (
                      <p className="text-xs text-gray-400 italic mb-1.5 line-clamp-1">&ldquo;{comment.snippet}&rdquo;</p>
                    )}
                    <p className="text-sm text-gray-700 leading-snug">{comment.note}</p>
                  </button>
                );
              })}

              {isStreaming && (
                <div className="flex items-center gap-3 px-3 py-3 bg-white rounded-lg border border-gray-100">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-sm text-gray-400">Finding next annotation…</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
