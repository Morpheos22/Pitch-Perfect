// POST /api/blob/upload
// Generates a signed client upload token for Vercel Blob storage.
// The client then uploads directly to Vercel Blob (bypassing our 4.5MB serverless limit).
//
// Flow:
//   1. Client POSTs here with { fileName, fileType, category }
//   2. Server validates input + authentication
//   3. Server generates a unique blob pathname and a client upload token
//   4. Client PUTs the file directly to Vercel Blob using the token
//
// Requires BLOB_READ_WRITE_TOKEN environment variable (auto-set on Vercel).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { blobUploadSchema } from "@/lib/validation/schemas";

export async function POST(request: NextRequest) {
  try {
    // Auth check — only authenticated users can upload
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = blobUploadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { fileName, fileType, category } = parsed.data;

    // Generate a unique pathname to prevent collisions and enforce organization
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `${category}/${timestamp}-${random}-${safeName}`;

    // Try to generate a client upload token using @vercel/blob
    try {
      const { generateClientTokenFromUploadUrl } = await import("@vercel/blob");
      const BLOB_BASE_URL = process.env.BLOB_BASE_URL || "https://blob.vercel-storage.com";
      const uploadUrl = `${BLOB_BASE_URL}/${pathname}`;

      const clientToken = await generateClientTokenFromUploadUrl(uploadUrl, {
        // Token valid for 10 minutes
        validUntil: Date.now() + 10 * 60 * 1000,
      });

      return NextResponse.json({
        pathname,
        clientToken,
        uploadUrl,
      });
    } catch (blobSdkError: any) {
      // If @vercel/blob is not configured (no BLOB_READ_WRITE_TOKEN),
      // fall back to server-side upload via our storage module
      console.warn("[Blob Upload] Vercel Blob SDK unavailable, using server-side fallback:", blobSdkError?.message);

      // Return a signal to the client to use the legacy FormData upload path
      return NextResponse.json(
        { error: "Direct blob upload unavailable. Please use the standard upload method for files under 4.5MB." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("[Blob Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload token" },
      { status: 500 }
    );
  }
}
