// POST /api/blob/upload
// Server-side upload to Vercel Blob storage.
//
// Flow:
//   1. Client POSTs here with FormData { file, category }
//   2. Server validates input + authentication
//   3. Server uploads directly to Vercel Blob using the SDK `put` method
//   4. Returns the blob URL and metadata to the client
//
// Requires BLOB_READ_WRITE_TOKEN environment variable (auto-set on Vercel).

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";

export async function POST(request: NextRequest) {
  try {
    // Auth check — only authenticated users can upload
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse FormData from the request
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "general";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file size (50MB max for blob uploads)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 50MB." },
        { status: 400 }
      );
    }

    // Generate a unique pathname to prevent collisions and enforce organization
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `${category}/${timestamp}-${random}-${safeName}`;

    // Upload to Vercel Blob using the SDK
    const blob = await put(pathname, file, {
      access: "public",
      addRandomSuffix: false,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      size: file.size,
    });
  } catch (error: any) {
    console.error("[Blob Upload] Error:", error);

    // Check for missing blob token
    if (error?.message?.includes("BLOB_READ_WRITE_TOKEN") || error?.message?.includes("token")) {
      return NextResponse.json(
        { error: "Blob storage is not configured. Please set BLOB_READ_WRITE_TOKEN." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
