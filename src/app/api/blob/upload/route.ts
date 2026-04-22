// POST /api/blob/upload
// Server-side route for Vercel Blob client-side upload token generation.
//
// WHY THIS EXISTS:
//   Vercel's serverless functions have a 4.5MB request body limit on Hobby,
//   50MB on Pro. To support files of ANY size, we use @vercel/blob's
//   client-side upload pattern:
//
//   1. Browser calls upload() from @vercel/blob/client with handleUploadUrl pointing here
//   2. This route receives a lightweight JSON request (no file!) to generate a client token
//   3. The client token contains constraints (max size, allowed types, addRandomSuffix)
//   4. Browser uploads the file DIRECTLY to Vercel Blob using the token
//   5. No serverless body limit is ever hit because the file never passes through our function
//
// FLOW:
//   Client: upload(filename, file, { access: 'public', handleUploadUrl: '/api/blob/upload', clientPayload: '{"category":"deck"}' })
//   → Server: handleUpload() → onBeforeGenerateToken() validates auth + category → returns token options
//   → Client: uploads directly to Vercel Blob → returns { url, pathname, downloadUrl }

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { handleUpload } from "@vercel/blob/client";

export const maxDuration = 60;

// Maximum file sizes per category — single source of truth.
// Client blob-upload.ts must use the same limits.
const MAX_FILE_SIZES: Record<string, number> = {
  deck: 50 * 1024 * 1024, // 50MB
  script: 10 * 1024 * 1024, // 10MB
  video: 500 * 1024 * 1024, // 500MB
};

// Allowed MIME types per category — enforced in the client token.
// The client token constrains what content types Vercel Blob will accept.
const ALLOWED_CONTENT_TYPES: Record<string, string[]> = {
  deck: [
    "application/pdf",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  script: [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
  ],
  video: [
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
  ],
};

// Valid categories
const VALID_CATEGORIES = ["deck", "script", "video"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export async function POST(request: NextRequest) {
  try {
    // Parse the request body — handleUpload expects the raw body from the client
    const body = await request.json();

    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (
        pathname: string,
        clientPayload: string | null,
        multipart: boolean,
      ) => {
        // ── 1. Auth check ──
        const { userId: clerkId } = await auth();
        if (!clerkId) {
          throw new Error("Unauthorized — you must be signed in to upload files");
        }

        // ── 2. Parse client payload to get category ──
        let category: Category = "deck"; // default
        if (clientPayload) {
          try {
            const parsed = JSON.parse(clientPayload);
            if (parsed.category && VALID_CATEGORIES.includes(parsed.category)) {
              category = parsed.category;
            }
          } catch {
            // Invalid JSON — use default category
          }
        }

        // ── 3. Validate file extension against category ──
        const ext = pathname.toLowerCase().split(".").pop() || "";
        const ALLOWED_EXTENSIONS: Record<string, string[]> = {
          deck: [".pdf", ".pptx", ".ppt"],
          script: [".pdf", ".docx", ".doc", ".txt"],
          video: [".mp4", ".webm", ".mov", ".avi"],
        };
        const allowed = ALLOWED_EXTENSIONS[category] || [];
        if (!allowed.includes(`.${ext}`)) {
          throw new Error(
            `Invalid file type ".${ext}" for category "${category}". Allowed: ${allowed.join(", ")}`
          );
        }

        // ── 4. Return token options with constraints ──
        // These constraints are enforced by Vercel Blob when the client uploads.
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES[category] || [],
          maximumSizeInBytes: MAX_FILE_SIZES[category],
          addRandomSuffix: true,
          tokenPayload: clientPayload,
        };
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Blob Upload] Token generation failed:", error);
    const message =
      error instanceof Error ? error.message : "Upload token generation failed";
    const status = message.includes("Unauthorized") ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
