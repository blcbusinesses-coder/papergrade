import { NextRequest } from "next/server";
import { gradeOnly, extractKeyPhrases } from "@/lib/openai";
import { searchPapers } from "@/lib/semanticScholar";

export const runtime = "nodejs";
export const maxDuration = 300;

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(req: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "OpenAI API key is not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const body = await req.json();
  const { text } = body as { text: string };

  if (!text || text.trim().length < 50) {
    return new Response(
      JSON.stringify({ error: "Paper text is too short to grade." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Extract title for a focused OpenAlex search
        const { title } = await extractKeyPhrases(text);

        // Step 2: Find 3–5 real professional papers on this topic
        const papers = await searchPapers(title, 5);

        // Stream the compared papers immediately so the sidebar can show them
        controller.enqueue(sseEvent({ type: "papers", papers }));

        // Step 3: Grade the paper, using the professional papers as context
        const { grade, comments } = await gradeOnly(text, papers);

        // Step 4: Stream the grade so the badge appears right away
        controller.enqueue(sseEvent({ type: "grade", grade }));

        // Step 5: Stream each annotation (no per-comment API calls needed)
        for (const comment of comments) {
          controller.enqueue(sseEvent({ type: "comment", comment }));
        }

        controller.enqueue(sseEvent({ type: "done" }));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Grading failed.";
        controller.enqueue(sseEvent({ type: "error", message }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
