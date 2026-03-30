"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Mark, mergeAttributes } from "@tiptap/core";
import { useCallback, useEffect } from "react";
import { GradeComment } from "@/lib/openai";

// ─── Custom AiHighlight Mark ────────────────────────────────────────────────

const AiHighlight = Mark.create({
  name: "aiHighlight",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      color: {
        default: "yellow",
        parseHTML: (el) => el.getAttribute("data-color"),
        renderHTML: (attrs) => ({ "data-color": attrs.color }),
      },
      commentIndex: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment-index"),
        renderHTML: (attrs) => ({
          "data-comment-index": String(attrs.commentIndex ?? ""),
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "mark[data-color]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function endsWithSentence(line: string) {
  return /[.!?]['")\]]*\s*$/.test(line);
}

function isTitleCase(line: string): boolean {
  const words = line.trim().split(/\s+/);
  const longWords = words.filter((w) => w.length >= 4);
  if (longWords.length === 0) return true;
  const capped = longWords.filter((w) => /^[A-Z]/.test(w));
  return capped.length / longWords.length >= 0.6;
}

function looksLikeHeading(line: string, prevWasHeadingOrEmpty: boolean): boolean {
  const trimmed = line.trim();
  if (trimmed.length <= 2) return false;
  if (trimmed.length >= 80) return false;
  if (trimmed.endsWith(".") || trimmed.endsWith(",") || trimmed.endsWith(";")) return false;
  if (/^\d/.test(trimmed)) return false;
  if (/^[a-z]/.test(trimmed)) return false;
  if (prevWasHeadingOrEmpty) return true;
  return trimmed.length < 60 && isTitleCase(trimmed);
}

function textToHtml(text: string): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n");

  const rawLines = normalized.split("\n");
  const blocks: { type: "h1" | "h2" | "p"; text: string }[] = [];
  let currentPara = "";
  let prevWasEmpty = true;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();

    if (!line) {
      if (currentPara) {
        blocks.push({ type: "p", text: currentPara });
        currentPara = "";
      }
      prevWasEmpty = true;
      continue;
    }

    if (looksLikeHeading(line, prevWasEmpty)) {
      if (currentPara) {
        blocks.push({ type: "p", text: currentPara });
        currentPara = "";
      }
      const tag = blocks.length === 0 ? "h1" : "h2";
      blocks.push({ type: tag, text: line });
      prevWasEmpty = true;
      continue;
    }

    if (currentPara) {
      if (currentPara.endsWith("-")) {
        currentPara = currentPara.slice(0, -1) + line;
      } else {
        currentPara += " " + line;
      }
    } else {
      currentPara = line;
    }

    prevWasEmpty = false;

    const nextLine = rawLines[i + 1]?.trim() ?? "";
    const lineAfter = rawLines[i + 2]?.trim() ?? "";
    const nextIsBlank = nextLine === "";
    const nextIsHeading =
      nextLine.length > 0 &&
      looksLikeHeading(nextLine, true) &&
      endsWithSentence(currentPara);
    const nextStartsNewPara =
      endsWithSentence(currentPara) &&
      nextLine.length > 0 &&
      lineAfter === "" &&
      !looksLikeHeading(nextLine, true);

    if (nextIsBlank || nextIsHeading || nextStartsNewPara) {
      blocks.push({ type: "p", text: currentPara });
      currentPara = "";
      prevWasEmpty = nextIsBlank;
    }
  }

  if (currentPara) {
    blocks.push({ type: "p", text: currentPara });
  }

  return blocks
    .map(({ type, text }) => {
      const e = escapeHtml(text);
      if (type === "h1") return `<h1>${e}</h1>`;
      if (type === "h2") return `<h2>${e}</h2>`;
      return `<p>${e}</p>`;
    })
    .join("");
}

// ─── Editor ref API ──────────────────────────────────────────────────────────
// NOTE: We use a regular prop (editorRef) instead of React's `ref` prop because
// next/dynamic wraps the component in a LoadableComponent that silently drops refs.

export interface EditorRef {
  applyHighlights: (comments: GradeComment[]) => void;
  clearHighlights: () => void;
  scrollToComment: (index: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface EditorProps {
  pendingText: string;
  onTextChange: (text: string) => void;
  onHighlightClick: (commentIndex: number) => void;
  /** Pass a MutableRefObject; we update .current when the editor is ready. */
  editorRef?: React.MutableRefObject<EditorRef | null>;
}

export default function Editor({
  pendingText,
  onTextChange,
  onHighlightClick,
  editorRef,
}: EditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Drop or upload your paper to begin...",
      }),
      AiHighlight,
    ],
    editorProps: {
      attributes: { class: "focus:outline-none" },
    },
    content: "",
    onUpdate: ({ editor: e }) => {
      onTextChange(e.getText());
    },
  });

  // Apply pendingText whenever it changes AND the editor is ready
  useEffect(() => {
    if (!editor || !pendingText) return;
    const html = textToHtml(pendingText);
    editor.commands.setContent(html || pendingText);
    editor.commands.setTextSelection(0);
    onTextChange(editor.getText());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, pendingText]);

  // Handle clicks on highlighted marks via DOM event delegation
  const handleEditorClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      const mark = target.closest("mark[data-comment-index]");
      if (mark) {
        const idx = mark.getAttribute("data-comment-index");
        if (idx !== null && idx !== "") {
          onHighlightClick(Number(idx));
        }
      }
    },
    [onHighlightClick]
  );

  // ── Highlight logic ───────────────────────────────────────────────────────

  const applyHighlights = useCallback(
    (comments: GradeComment[]) => {
      if (!editor) return;

      const { schema } = editor.state;
      const markType = schema.marks["aiHighlight"];
      if (!markType) {
        console.warn("[PaperGrade] aiHighlight mark type not found in schema");
        return;
      }

      // Step 1: clear existing aiHighlight marks (direct ProseMirror transaction)
      {
        const clearTr = editor.state.tr;
        clearTr.removeMark(0, editor.state.doc.content.size, markType);
        editor.view.dispatch(clearTr);
      }

      // Step 2: build a character-level map from the freshly-cleared doc
      // Each slot is a real character (pmPos = its ProseMirror position) or a
      // synthetic block-separator space (pmPos = null).
      const chars: Array<{ char: string; pmPos: number | null }> = [];
      let lastPmEnd = -1;

      editor.state.doc.descendants((node, pos) => {
        if (!node.isText || !node.text) return; // return undefined = keep descending
        if (lastPmEnd !== -1 && pos > lastPmEnd + 1) {
          chars.push({ char: " ", pmPos: null }); // synthetic space at block boundary
        }
        for (let i = 0; i < node.text.length; i++) {
          chars.push({ char: node.text[i], pmPos: pos + i });
        }
        lastPmEnd = pos + node.text.length - 1;
      });

      // Build whitespace-normalised string with index tracking
      const normChars: Array<{ char: string; origIdx: number }> = [];
      let lastWasSpace = false;
      for (let i = 0; i < chars.length; i++) {
        if (/\s/.test(chars[i].char)) {
          if (!lastWasSpace) { normChars.push({ char: " ", origIdx: i }); lastWasSpace = true; }
        } else {
          normChars.push({ char: chars[i].char, origIdx: i });
          lastWasSpace = false;
        }
      }
      const normText    = normChars.map((c) => c.char).join("");
      const normTextLow = normText.toLowerCase();

      console.log("[PaperGrade] doc text sample:", normText.slice(0, 120));

      // Step 3: add all marks in a single transaction
      const markTr = editor.state.tr;

      comments.forEach((comment, index) => {
        const snippet = (comment.snippet ?? "").trim().replace(/\s+/g, " ");
        if (!snippet) return;

        // Stage 1: exact normalized match; Stage 2: case-insensitive fallback
        let matchPos = normText.indexOf(snippet);
        if (matchPos === -1) matchPos = normTextLow.indexOf(snippet.toLowerCase());

        if (matchPos === -1) {
          console.warn(`[PaperGrade] snippet not found (#${index}):`, snippet.slice(0, 80));
          return;
        }

        let from: number | null = null;
        let to:   number | null = null;

        for (let i = matchPos; i < matchPos + snippet.length && i < normChars.length; i++) {
          const pmPos = chars[normChars[i].origIdx].pmPos;
          if (pmPos !== null) {
            if (from === null) from = pmPos;
            to = pmPos + 1;
          }
        }

        if (from === null || to === null) return;

        console.log(`[PaperGrade] mark #${index} [${from}–${to}]`, snippet.slice(0, 50));
        markTr.addMark(from, to, markType.create({
          color:        comment.highlightColor ?? "yellow",
          commentIndex: index,
        }));
      });

      editor.view.dispatch(markTr);
    },
    [editor]
  );

  const clearHighlights = useCallback(() => {
    if (!editor) return;
    const { schema } = editor.state;
    const markType = schema.marks["aiHighlight"];
    if (!markType) return;
    const tr = editor.state.tr;
    tr.removeMark(0, editor.state.doc.content.size, markType);
    editor.view.dispatch(tr);
  }, [editor]);

  const scrollToComment = useCallback(
    (index: number) => {
      if (!editor) return;
      const editorDom = editor.view.dom as HTMLElement;
      const marks = editorDom.querySelectorAll(`mark[data-comment-index="${index}"]`);
      if (marks.length === 0) return;
      const mark = marks[0] as HTMLElement;
      mark.scrollIntoView({ behavior: "smooth", block: "center" });
      mark.classList.add("highlight-pulse");
      setTimeout(() => mark.classList.remove("highlight-pulse"), 700);
    },
    [editor]
  );

  // ── Expose API via a regular prop ref (bypasses next/dynamic ref-drop bug) ─
  useEffect(() => {
    if (!editorRef) return;
    editorRef.current = { applyHighlights, clearHighlights, scrollToComment };
  }, [editorRef, applyHighlights, clearHighlights, scrollToComment]);

  return (
    <div className="tiptap-editor" onClick={handleEditorClick}>
      <EditorContent editor={editor} />
    </div>
  );
}
