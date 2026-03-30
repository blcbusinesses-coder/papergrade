"use client";

import { useState } from "react";
import { GradeComment } from "@/lib/openai";
import type { FormattedPaper } from "@/lib/semanticScholar";
import CommentCard from "./CommentCard";

interface SidebarProps {
  grade: string | null;
  comments: GradeComment[];
  papers: FormattedPaper[];
  isStreaming: boolean;
  activeIndex: number | null;
  onCardClick: (index: number) => void;
}

const GRADE_COLOR: Record<string, string> = {
  A: "text-green-600",
  B: "text-blue-600",
  C: "text-yellow-600",
  D: "text-orange-600",
  F: "text-red-600",
};

const GRADE_BG: Record<string, string> = {
  A: "bg-green-50 border-green-200",
  B: "bg-blue-50 border-blue-200",
  C: "bg-yellow-50 border-yellow-200",
  D: "bg-orange-50 border-orange-200",
  F: "bg-red-50 border-red-200",
};

const GRADE_LABEL: Record<string, string> = {
  A: "Excellent",
  B: "Good",
  C: "Satisfactory",
  D: "Needs Improvement",
  F: "Failing",
};

export default function Sidebar({ grade, comments, papers, isStreaming, activeIndex, onCardClick }: SidebarProps) {
  const g = grade?.toUpperCase() ?? "";
  const [papersOpen, setPapersOpen] = useState(false);

  return (
    <aside className="fixed right-0 top-[52px] h-[calc(100vh-52px)] w-80 bg-gray-50 border-l border-gray-200 flex flex-col z-10 shadow-lg hidden md:flex">

      {/* Grade header */}
      <div className="flex-none px-5 pt-5 pb-4 border-b border-gray-200 bg-white">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          AI Insights
        </h2>

        {!grade ? (
          <div className="flex flex-col items-center py-4 gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500 text-center">
              {papers.length > 0
                ? `Grading vs. ${papers.length} professional papers…`
                : "Finding comparable papers…"}
            </p>
          </div>
        ) : (
          <div className={`rounded-xl border p-4 flex flex-col items-center ${GRADE_BG[g] ?? "bg-gray-100 border-gray-200"}`}>
            <span className={`text-6xl font-bold leading-none ${GRADE_COLOR[g] ?? "text-gray-700"}`}>
              {g}
            </span>
            <span className="text-sm font-medium text-gray-500 mt-1">
              {GRADE_LABEL[g] ?? "Graded"}
            </span>
            <p className="text-xs text-gray-400 mt-1">
              {comments.length} annotation{comments.length !== 1 ? "s" : ""}
              {isStreaming && " — loading more…"}
            </p>
          </div>
        )}

        {/* Compared Papers toggle */}
        {papers.length > 0 && (
          <button
            onClick={() => setPapersOpen((o) => !o)}
            className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors duration-150 text-left"
          >
            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
              {/* book icon */}
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              </svg>
              Compared Papers ({papers.length})
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg" width="12" height="12"
              viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round"
              className={`text-gray-400 transition-transform duration-200 ${papersOpen ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        )}

        {/* Compared Papers list */}
        {papersOpen && papers.length > 0 && (
          <div className="mt-2 flex flex-col gap-2 max-h-56 overflow-y-auto sidebar-scroll">
            {papers.map((paper, i) => (
              <a
                key={i}
                href={paper.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block px-3 py-2 rounded-lg bg-white border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors duration-150 group"
              >
                <p className="text-xs font-medium text-gray-700 group-hover:text-blue-700 line-clamp-2 leading-snug">
                  {paper.title}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {paper.authors}{paper.year ? `, ${paper.year}` : ""}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Scrollable comment list */}
      <div className="flex-1 min-h-0 overflow-y-auto sidebar-scroll px-4 py-4 flex flex-col gap-3">
        {comments.map((comment, i) => (
          <CommentCard
            key={i}
            comment={comment}
            index={i}
            isActive={activeIndex === i}
            onClick={() => onCardClick(i)}
          />
        ))}

        {/* Loading placeholder while more annotations are incoming */}
        {isStreaming && (
          <div className="flex items-center gap-3 px-3 py-3 bg-white rounded-lg border border-gray-100 shadow-sm">
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
            <span className="text-sm text-gray-400">Finding next annotation…</span>
          </div>
        )}
      </div>
    </aside>
  );
}
