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
// File validation constants are imported from lib/file-validation.ts — the single source of truth.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { handleUpload } from "@vercel/blob/client";
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
  type FileCategory,
} from "@/lib/file-validation";

export const maxDuration = 60;

// Valid categories
const VALID_CATEGORIES: FileCategory[] = ["deck", "script", "video"];

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
        let category: FileCategory = "deck"; // default
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
        const allowed = ALLOWED_EXTENSIONS[category] || [];
        if (!allowed.includes(`.${ext}`)) {
          throw new Error(
            `Invalid file type ".${ext}" for category "${category}". Allowed: ${allowed.join(", ")}`
          );
        }

        // ── 4. Return token options with constraints ──
        // These constraints are enforced by Vercel Blob when the client uploads.
        return {
          allowedContentTypes: ALLOWED_MIME_TYPES[category] || [],
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
