import { NextRequest, NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { join } from "path";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (fileName.endsWith(".pdf")) {
      // Run pdf-parse in a child process to bypass webpack's module bundling
      const scriptPath = join(process.cwd(), "scripts", "pdf-extract.js");
      const result = spawnSync("node", [scriptPath], {
        input: buffer.toString("base64"),
        encoding: "utf8",
        timeout: 30000,
        maxBuffer: 50 * 1024 * 1024,
      });

      if (result.error) throw result.error;
      if (result.status !== 0) {
        throw new Error(result.stderr || "PDF extraction process failed");
      }

      const parsed = JSON.parse(result.stdout) as { text?: string; error?: string };
      if (parsed.error) throw new Error(parsed.error);
      text = parsed.text ?? "";

    } else if (fileName.endsWith(".docx")) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;

    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a PDF or DOCX file." },
        { status: 400 }
      );
    }

    text = text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: "Could not extract meaningful text from the file." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (err) {
    console.error("Extract error:", err);
    return NextResponse.json(
      { error: "Failed to extract text from file." },
      { status: 500 }
    );
  }
}
