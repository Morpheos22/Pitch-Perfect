// POST /api/blob/upload
// Server-side blob upload proxy for Vercel Blob storage.
//
// WHY THIS EXISTS:
//   @vercel/blob v2.3.3 requires server-side put() with BLOB_READ_WRITE_TOKEN.
//   The client cannot call put() directly — it must go through a server route.
//   The client-side blob-upload.ts POSTs FormData to this route, which then
//   calls put() server-side and returns the blob URL.
//
// FLOW:
//   1. Verify Clerk authentication
//   2. Parse FormData (file + category)
//   3. Validate file type and size
//   4. Upload to Vercel Blob using @vercel/blob put() with access: 'private'
//   5. Return { url, pathname } to the client

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import {
  generateFileKey,
  validateFileTypeByCategory,
  validateFileSizeByCategory,
} from "@/lib/storage";

// Maximum file sizes per category (server-side enforcement)
const MAX_FILE_SIZES: Record<string, number> = {
  deck: 50 * 1024 * 1024, // 50MB
  script: 10 * 1024 * 1024, // 10MB
  video: 500 * 1024 * 1024, // 500MB
};

// Valid categories
const VALID_CATEGORIES = ["deck", "script", "video"] as const;
type Category = (typeof VALID_CATEGORIES)[number];

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth check ──
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── 2. Check BLOB_READ_WRITE_TOKEN ──
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error("[Blob Upload] BLOB_READ_WRITE_TOKEN not configured");
      return NextResponse.json(
        { error: "Blob storage is not configured. Please contact support." },
        { status: 503 }
      );
    }

    // ── 3. Parse FormData ──
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = formData.get("category") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    if (!category || !VALID_CATEGORIES.includes(category as Category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    const validCategory = category as Category;

    // ── 4. Validate file type ──
    const mimeType = file.type || "application/octet-stream";
    const typeValidation = validateFileTypeByCategory(
      file.name,
      mimeType,
      validCategory
    );
    if (!typeValidation.valid) {
      return NextResponse.json(
        { error: typeValidation.error },
        { status: 400 }
      );
    }

    // ── 5. Validate file size ──
    const maxSize = MAX_FILE_SIZES[validCategory];
    if (file.size > maxSize) {
      const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
      return NextResponse.json(
        { error: `File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum: ${maxMB}MB` },
        { status: 400 }
      );
    }

    // ── 6. Generate storage key ──
    // Use clerkId as part of the key (we don't have the DB userId at this point,
    // but the key just needs to be unique and organized)
    const key = generateFileKey(clerkId, validCategory, file.name);

    // ── 7. Upload to Vercel Blob ──
    console.log(
      `[Blob Upload] Uploading ${file.name} (${(file.size / 1024).toFixed(1)}KB) to category: ${validCategory}`
    );

    const blob = await put(key, file, {
      access: "private",
      addRandomSuffix: true,
    });

    console.log(`[Blob Upload] Success: ${blob.pathname}`);

    // ── 8. Return result ──
    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      downloadUrl: blob.downloadUrl,
    });
  } catch (error) {
    console.error("[Blob Upload] Failed:", error);
    const message =
      error instanceof Error ? error.message : "Upload failed unexpectedly";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
