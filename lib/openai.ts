import OpenAI from "openai";
import type { FormattedPaper } from "./semanticScholar";

// Lazy singleton — instantiated on first call, not at module load time.
// This prevents Next.js from throwing during build-time page-data collection
// when OPENAI_API_KEY is not available in the build environment.
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _openai;
}

export interface GradeComment {
  label: string;
  note: string;
  snippet: string;
  highlightColor: "yellow" | "red" | "green";
}

// ─── Extract key phrases for search queries ──────────────────────────────────

export async function extractKeyPhrases(
  text: string
): Promise<{ title: string; phrases: string[] }> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 0,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content:
          'Extract the paper title (or infer one) and 3 short academic search phrases (4-8 words each). Return JSON only: { "title": string, "phrases": [string, string, string] }',
      },
      { role: "user", content: text.slice(0, 4000) },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0].message.content ?? "{}");
  return {
    title: parsed.title ?? "Unknown Paper",
    phrases: Array.isArray(parsed.phrases) ? parsed.phrases : [],
  };
}

// ─── Grade the paper ─────────────────────────────────────────────────────────
// Accepts optional professional papers for context so GPT can compare.

export async function gradeOnly(
  text: string,
  papers?: FormattedPaper[]
): Promise<{ grade: string; comments: GradeComment[] }> {

  const paperContext =
    papers && papers.length > 0
      ? `For reference, here are ${papers.length} professional paper(s) on this topic:\n\n` +
        papers
          .map(
            (p, i) =>
              `[${i + 1}] "${p.title}" (${p.year ?? "n/d"}) — ${p.authors}\n${p.abstract.slice(0, 300)}`
          )
          .join("\n\n") +
        "\n\nConsider how the student's work compares to professional scholarship when grading.\n\n"
      : "";

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    temperature: 0.3,
    max_tokens: 2500,
    messages: [
      {
        role: "system",
        content: `You are a university professor grading a student paper. Mark it up like a teacher with a red pen.

${paperContext}Rules:
1. Give an overall letter grade: A, B, C, D, or F.
2. Leave 6–10 margin comments spread across the ENTIRE paper (intro, body, conclusion).
3. For each comment:
   - "snippet": EXACT verbatim phrase from the paper (10–25 words, must exist word-for-word).
   - "label": Short 2–5 word tag (e.g. "Needs evidence", "Strong point", "Vague claim").
   - "note": 1-2 direct sentences a teacher would write in the margin.
   - "highlightColor": "green" (strength), "yellow" (needs work), "red" (significant problem).
4. Return ONLY valid JSON:
{
  "grade": "B",
  "comments": [
    {
      "snippet": "exact verbatim phrase from the paper",
      "label": "Needs evidence",
      "note": "This claim needs a citation. What study supports this?",
      "highlightColor": "yellow"
    }
  ]
}`,
      },
      { role: "user", content: text.slice(0, 12000) },
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(response.choices[0].message.content ?? "{}");
  return {
    grade: parsed.grade ?? "C",
    comments: Array.isArray(parsed.comments) ? parsed.comments : [],
  };
}
