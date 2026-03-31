import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

function extractDocId(url: string): string | null {
  // Handles:
  //   https://docs.google.com/document/d/DOC_ID/edit
  //   https://docs.google.com/document/d/DOC_ID/view
  //   https://docs.google.com/document/d/DOC_ID/
  const match = url.match(/\/document\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = (await req.json()) as { url?: string };

    if (!url?.trim()) {
      return NextResponse.json({ error: "No URL provided." }, { status: 400 });
    }

    const docId = extractDocId(url);
    if (!docId) {
      return NextResponse.json(
        { error: "Could not extract a document ID from that URL. Make sure it is a valid Google Docs link." },
        { status: 400 }
      );
    }

    // Export as plain text — works for publicly shared documents
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const res = await fetch(exportUrl, {
      headers: { "User-Agent": "PaperGrade/1.0" },
      redirect: "follow",
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        {
          error:
            "That document is not publicly accessible. In Google Docs, go to Share → Change → Anyone with the link → Viewer, then try again.",
        },
        { status: 403 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Docs returned an error (${res.status}). Make sure the document is set to public.` },
        { status: 502 }
      );
    }

    let text = await res.text();

    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: "The document appears to be empty or too short to grade." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[PaperGrade] Google Docs extract error:", err);
    return NextResponse.json(
      { error: "Failed to fetch the Google Doc. Make sure the link is correct and the document is public." },
      { status: 500 }
    );
  }
}
