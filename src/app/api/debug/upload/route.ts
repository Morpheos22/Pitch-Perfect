import { NextRequest, NextResponse } from "next/server";

/**
 * Diagnostic endpoint: tests file upload chain end-to-end.
 * POST a file here to see exactly what the server receives.
 * No auth required (temporary for debugging).
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const results: Record<string, unknown> = {};

  // 1. Check request basics
  results.contentType = request.headers.get("content-type");
  results.contentLength = request.headers.get("content-length");
  results.method = request.method;

  try {
    // 2. Try to parse as FormData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      results.fileReceived = false;
      results.allFormFields = Array.from(formData.keys());
      return NextResponse.json({ ...results, timing: Date.now() - startTime });
    }

    results.fileReceived = true;
    results.fileName = file.name;
    results.fileType = file.type;
    results.fileSize = file.size;

    // 3. Try to read the file
    const arrayBuffer = await file.arrayBuffer();
    results.arrayBufferLength = arrayBuffer.byteLength;
    results.firstBytes = Array.from(new Uint8Array(arrayBuffer.slice(0, 20)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");

    // 4. Try to parse as text
    try {
      const text = await file.text();
      results.textLength = text.length;
      results.textPreview = text.substring(0, 200);
    } catch (textErr: unknown) {
      results.textError = textErr instanceof Error ? textErr.message : String(textErr);
    }

    // 5. Try to detect file type and parse
    const ext = file.name.toLowerCase().split(".").pop() || "";
    results.detectedExtension = ext;

    try {
      const { extractFileText } = await import("@/lib/file-parser");
      const extractedText = await extractFileText(file);
      results.extractedTextLength = extractedText.length;
      results.extractedTextPreview = extractedText.substring(0, 200);
      results.parseSuccess = true;
    } catch (parseErr: unknown) {
      results.parseError = parseErr instanceof Error ? parseErr.message : String(parseErr);
      results.parseSuccess = false;
      // Also log the stack trace
      if (parseErr instanceof Error) {
        results.parseStack = parseErr.stack?.substring(0, 500);
      }
    }
  } catch (formErr: unknown) {
    results.formDataError = formErr instanceof Error ? formErr.message : String(formErr);

    // If FormData fails, try JSON
    try {
      const body = await request.clone().json();
      results.jsonBody = body;
    } catch {
      results.jsonParseFailed = true;
    }
  }

  results.timing = Date.now() - startTime;
  return NextResponse.json(results);
}

// Allow without auth for debugging
export async function GET() {
  return NextResponse.json({
    message: "POST a file to this endpoint to diagnose upload issues",
    usage: "curl -X POST -F 'file=@test.pdf' /api/debug/upload",
  });
}
