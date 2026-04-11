// POST /api/blob/upload
// Server-side proxy for uploading files to Vercel Blob storage.
//
// WHY THIS EXISTS:
//   - Vercel serverless functions have a 4.5MB body limit on Hobby tier.
//   - Client-side direct upload to Vercel Blob requires `generateClientTokenFromUploadUrl`,
//     which was removed in @vercel/blob v2.x.
//   - This route receives the file via FormData and uploads server-side using `put()`.
//   - On Vercel's infrastructure, BLOB_READ_WRITE_TOKEN is auto-injected.
//   - For files > 4.5MB, the client must use a different approach (R2 or chunked upload).
//
// Flow:
//   1. Client POSTs FormData { file, category } here
//   2. Server validates input + authentication
//   3. Server uploads to Vercel Blob using the SDK `put()` method
//   4. Returns the blob URL, pathname, and metadata to the client

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Allowed categories and their file constraints
const CATEGORY_RULES: Record<string, { extensions: string[]; maxSize: number }> = {
  deck: {
    extensions: [".pdf", ".pptx", ".ppt"],
    maxSize: 4.5 * 1024 * 1024, // 4.5MB (serverless body limit)
  },
  script: {
    extensions: [".pdf", ".docx", ".doc", ".txt"],
    maxSize: 4.5 * 1024 * 1024,
  },
  video: {
    extensions: [".mp4", ".webm", ".mov", ".avi"],
    maxSize: 4.5 * 1024 * 1024,
  },
};

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
    const category = (formData.get("category") as string) || "deck";

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file extension
    const rules = CATEGORY_RULES[category] || CATEGORY_RULES.deck;
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
    if (!rules.extensions.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file format "${ext}". Accepted: ${rules.extensions.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate file size (4.5MB serverless limit)
    if (file.size > rules.maxSize) {
      const maxMB = (rules.maxSize / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum for direct upload: ${maxMB}MB. For larger files, please use a smaller file.` },
        { status: 413 }
      );
    }

    // Generate a unique pathname for organization
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `${category}/${timestamp}-${random}-${safeName}`;

    // Upload to Vercel Blob using the server-side SDK
    try {
      const { put } = await import("@vercel/blob");
      const blob = await put(pathname, file, {
        access: "public",
        addRandomSuffix: false,
      });

      return NextResponse.json({
        url: blob.url,
        pathname: blob.pathname,
        downloadUrl: blob.downloadUrl,
        contentType: file.type,
        size: file.size,
      });
    } catch (blobError: any) {
      console.error("[Blob Upload] Vercel Blob SDK error:", blobError?.message);

      // If BLOB_READ_WRITE_TOKEN is missing, Vercel Blob won't work
      if (blobError?.message?.includes("BLOB_READ_WRITE_TOKEN") ||
          blobError?.message?.includes("token") ||
          blobError?.message?.includes("No token")) {
        return NextResponse.json(
          { error: "Blob storage not configured. Falling back to direct upload." },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: "Failed to upload to blob storage. Please try direct upload instead." },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error("[Blob Upload] Error:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
