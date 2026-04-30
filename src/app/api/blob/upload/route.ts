// POST /api/blob/upload
// Generates a client-side upload token for Vercel Blob.
//
// This route is REQUIRED by @vercel/blob/client upload() — the SDK sends a
// lightweight POST here to get a signed token, then uploads the file directly
// from the browser to Vercel Blob. This bypasses Vercel's serverless body
// size limit entirely (4.5MB default).
//
// Flow:
//   1. Browser calls upload() from @vercel/blob/client
//   2. SDK POSTs here for a client token (this route)
//   3. We verify auth + validate file constraints server-side
//   4. handleUpload() returns a signed token with our constraints baked in
//   5. Browser uploads directly to Vercel Blob using that token
//   6. File never touches our serverless function — no body size limit issue
//
// Security:
//   - Clerk authentication required (401 if not signed in)
//   - File type and size constraints enforced via allowedContentTypes / maximumSizeInBytes
//   - Category is extracted from clientPayload and validated against known categories
//   - The token is single-use and expires (default 1 hour)

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { del } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZES,
  type FileCategory,
} from "@/lib/file-validation";

export const dynamic = "force-dynamic";

function isValidCategory(value: string): value is FileCategory {
  return ["deck", "script", "video"].includes(value);
}

export async function POST(request: NextRequest) {
  // ── Step 1: Verify Clerk authentication ──
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in to upload files." },
      { status: 401 }
    );
  }

  // ── Step 2: Parse the request body to extract clientPayload early ──
  // We need the category from clientPayload BEFORE calling handleUpload(),
  // because the category determines the file constraints (types, sizes).
  let requestBody: HandleUploadBody;
  try {
    requestBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  // Extract category from clientPayload (sent by blob-upload.ts as JSON)
  const clientPayloadStr =
    requestBody.type === "blob.generate-client-token"
      ? requestBody.payload.clientPayload
      : null;

  const category = clientPayloadStr
    ? (() => {
        try {
          const parsed = JSON.parse(clientPayloadStr);
          return parsed.category as string | undefined;
        } catch {
          return undefined;
        }
      })()
    : undefined;

  if (!category || !isValidCategory(category)) {
    return NextResponse.json(
      { error: "Invalid or missing upload category. Must be one of: deck, script, video." },
      { status: 400 }
    );
  }

  // ── Step 3: Build constraints based on category ──
  // These constraints are baked into the signed token — the Vercel Blob
  // upload service will REJECT any file that doesn't match, even if a
  // malicious client tries to bypass client-side validation.
  const allowedContentTypes = ALLOWED_MIME_TYPES[category];

  // Also allow generic MIME types that browsers sometimes report for valid files.
  // See file-validation.ts for the rationale on why extension + MIME mismatch
  // is treated as a warning, not a blocker.
  const extendedContentTypes = [
    ...allowedContentTypes,
    "application/octet-stream",  // Common fallback MIME for many file types
    "application/x-zip-compressed",  // PPTX files are ZIP archives
    "application/zip",  // PPTX/DOCX are ZIP-based
  ];

  const maximumSizeInBytes = MAX_FILE_SIZES[category];

  // ── Step 4: Call handleUpload() to generate the client token ──
  // handleUpload() reads the request body itself to determine the event type
  // (generate-client-token or upload-completed) and dispatches accordingly.
  //
  // IMPORTANT: handleUpload() requires BLOB_READ_WRITE_TOKEN to be set in the
  // environment. If the token is missing or invalid, the Vercel Blob API will
  // reject the token generation request, and the client-side upload() function
  // will show "vercel blob could not retrieve client token".
  //
  // The token format should be either:
  //   - vercel_blob_rw_<storeId>_<rest> (classic format)
  //   - vcp_<rest> (newer Vercel platform token format)
  // Both formats are supported by @vercel/blob@2.x.

  // Pre-check: verify BLOB_READ_WRITE_TOKEN exists before calling handleUpload
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error("[Blob Upload] BLOB_READ_WRITE_TOKEN is not set in environment");
    return NextResponse.json(
      { error: "Server storage not configured. Please contact support." },
      { status: 500 }
    );
  }

  // Token format validation: BLOB_READ_WRITE_TOKEN must be a Vercel blob token
  // (vercel_blob_rw_...) or a Vercel platform token (vcp_...).
  // A Vercel API token (bearer format) will fail with "could not retrieve client token".
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
  if (!blobToken.startsWith('vercel_blob_rw_') && !blobToken.startsWith('vcp_')) {
    console.error(`[Blob Upload] BLOB_READ_WRITE_TOKEN has unexpected format (prefix: ${blobToken.substring(0, 12)}...). Expected vercel_blob_rw_* or vcp_*. This usually means a Vercel API token was set instead of a Blob store token.`);
    return NextResponse.json(
      { error: "Storage token misconfigured. Please contact support." },
      { status: 500 }
    );
  }

  try {
    const result = await handleUpload({
      body: requestBody,
      request,
      onBeforeGenerateToken: async (pathname, _clientPayload, _multipart) => {
        // Server-side validation: check file extension matches category
        const ext = pathname.toLowerCase().substring(pathname.lastIndexOf("."));
        const allowedExts = ALLOWED_EXTENSIONS[category];

        if (!allowedExts.includes(ext)) {
          throw new Error(
            `Invalid file type "${ext}". Accepted for ${category}: ${allowedExts.join(", ")}`
          );
        }

        return {
          allowedContentTypes: extendedContentTypes,
          maximumSizeInBytes,
          tokenPayload: JSON.stringify({
            userId,
            category,
            ext,
          }),
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Called when Vercel Blob confirms the upload completed.
        // We could update the database here, but currently the coach API routes
        // handle DB persistence after they receive the blob URL.
        console.log(
          `[Blob Upload] Upload completed: ${blob.pathname} (${blob.contentType})`,
          tokenPayload ? `Token payload: ${tokenPayload}` : ""
        );
      },
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Upload token generation failed.";

    // Distinguish between validation errors (client fault) and server errors
    if (
      message.includes("Invalid file type") ||
      message.includes("allowedContentTypes") ||
      message.includes("maximumSizeInBytes") ||
      message.includes("size")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Log detailed error for server-side diagnostics
    // Include token format info to help debug BLOB_READ_WRITE_TOKEN issues
    const tokenPrefix = process.env.BLOB_READ_WRITE_TOKEN?.substring(0, 10) || 'MISSING';
    console.error(`[Blob Upload] Token generation failed (token prefix: ${tokenPrefix}):`, error);
    return NextResponse.json(
      { error: "Failed to generate upload token. Please try again." },
      { status: 500 }
    );
  }
}

// DELETE /api/blob/upload?url=...
// Deletes an orphaned blob that was uploaded but not used (e.g., if the
// coach API rejected the request after the blob was already uploaded).
// This is called as fire-and-forget from the client-side error handlers.
//
// Security:
//   - Requires Clerk authentication
//   - Only deletes Vercel Blob URLs (validates hostname)
//   - Best-effort — errors are logged but don't block the user
export async function DELETE(request: NextRequest) {
  // ── Step 1: Verify Clerk authentication ──
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "You must be signed in to delete files." },
      { status: 401 }
    );
  }

  // ── Step 2: Extract and validate the blob URL ──
  const blobUrl = request.nextUrl.searchParams.get("url");
  if (!blobUrl) {
    return NextResponse.json(
      { error: "Missing url parameter." },
      { status: 400 }
    );
  }

  // Validate the URL is a Vercel Blob URL (prevent arbitrary URL deletion)
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(blobUrl);
  } catch {
    return NextResponse.json(
      { error: "Invalid URL." },
      { status: 400 }
    );
  }

  const isVercelBlob =
    parsedUrl.hostname.endsWith(".blob.vercel-storage.com") ||
    parsedUrl.hostname.endsWith(".public.blob.vercel-storage.com");

  if (!isVercelBlob) {
    return NextResponse.json(
      { error: "Only Vercel Blob URLs can be deleted." },
      { status: 400 }
    );
  }

  // ── Step 3: Delete the blob ──
  try {
    await del(blobUrl);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    // Best-effort cleanup — log the error but don't fail loudly
    console.error("[Blob Upload] Failed to delete orphaned blob:", error);
    return NextResponse.json(
      { error: "Failed to delete blob." },
      { status: 500 }
    );
  }
}
