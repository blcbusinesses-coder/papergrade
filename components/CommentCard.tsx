"use client";

import { GradeComment } from "@/lib/openai";

interface CommentCardProps {
  comment: GradeComment;
  index: number;
  isActive: boolean;
  onClick: () => void;
}

const COLOR_LEFT_BORDER: Record<string, string> = {
  yellow: "border-l-yellow-400",
  red: "border-l-red-400",
  green: "border-l-green-500",
};

const COLOR_LABEL_BG: Record<string, string> = {
  yellow: "bg-yellow-50 text-yellow-700",
  red: "bg-red-50 text-red-700",
  green: "bg-green-50 text-green-700",
};

const COLOR_DOT: Record<string, string> = {
  yellow: "bg-yellow-400",
  red: "bg-red-400",
  green: "bg-green-500",
};

export default function CommentCard({ comment, index, isActive, onClick }: CommentCardProps) {
  const color = comment.highlightColor ?? "yellow";

  return (
    <button
      data-card-index={index}
      onClick={onClick}
      className={`
        w-full text-left bg-white rounded-lg shadow-sm
        border-l-4 border border-gray-100
        ${COLOR_LEFT_BORDER[color]}
        transition-all duration-200 ease-in-out
        hover:shadow-md cursor-pointer
        ${isActive ? "ring-2 ring-blue-400 border-transparent" : ""}
      `}
    >
      <div className="p-3">
        {/* Label + dot */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${COLOR_DOT[color]}`} />
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${COLOR_LABEL_BG[color]}`}>
            {comment.label}
          </span>
        </div>

        {/* Quoted snippet */}
        {comment.snippet && (
          <blockquote className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2 mb-2 line-clamp-2">
            &ldquo;{comment.snippet}&rdquo;
          </blockquote>
        )}

        {/* Teacher note */}
        <p className="text-sm text-gray-700 leading-snug">{comment.note}</p>

      </div>
    </button>
  );
}
