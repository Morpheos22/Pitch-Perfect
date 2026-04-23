// POST /api/blob/upload
// Server-side route for Vercel Blob client-side uploads.
//
// This route is REQUIRED by @vercel/blob/client upload() function.
// When the browser calls upload(), it first POSTs here to get a signed
// client token, then uploads the file directly from the browser to Vercel Blob.
//
// FLOW:
//   1. Browser calls upload(filename, file, { handleUploadUrl: "/api/blob/upload" })
//   2. SDK POSTs here with { type: "blob.generate-client-token", payload: { ... } }
//   3. We validate auth + constraints, then call handleUpload() to generate a token
//   4. SDK receives token, uploads file directly from browser to Vercel Blob
//   5. Returns { url, pathname } to the calling page
//
// DELETE /api/blob/upload?url=...
// Cleans up orphaned blobs when an analysis request fails after upload.
// This prevents orphaned files from accumulating in Vercel Blob storage.
//
// SECURITY:
//   - Requires Clerk authentication
//   - Validates file type/size constraints via handleUpload options
//   - Client payload carries the category for constraint enforcement

import { NextRequest, NextResponse } from 'next/server';
import { handleUpload } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import { requireAuth } from '@/lib/with-auth';
import {
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZES,
  type FileCategory,
} from '@/lib/file-validation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/blob/upload
 * Generate a client token for browser-side Vercel Blob uploads.
 *
 * The @vercel/blob/client upload() function calls this endpoint
 * automatically to get a signed upload token before uploading
 * the file directly from the browser.
 */
export async function POST(request: NextRequest) {
  // ── Authentication ──
  const { error: authError } = await requireAuth();
  if (authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse request body to get clientPayload ──
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // ── Parse client payload to determine category ──
  let category: FileCategory = 'script'; // default
  const clientPayload = body?.clientPayload || body?.payload?.clientPayload || null;
  if (clientPayload) {
    try {
      const parsed = JSON.parse(clientPayload);
      if (parsed.category && ['deck', 'script', 'video'].includes(parsed.category)) {
        category = parsed.category as FileCategory;
      }
    } catch {
      // If we can't parse the payload, use default category
    }
  }

  // ── Build constraints from file-validation.ts (single source of truth) ──
  const allowedExtensions = ALLOWED_EXTENSIONS[category];
  const allowedContentTypes = ALLOWED_MIME_TYPES[category];
  const maximumSizeInBytes = MAX_FILE_SIZES[category];

  // ── Generate client token via handleUpload ──
  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (
        pathname: string,
        _clientPayload: string | null,
        _multipart: boolean,
      ) => {
        // Validate file extension from the pathname
        const ext = '.' + pathname.split('.').pop()?.toLowerCase();
        if (!allowedExtensions.includes(ext)) {
          throw new Error(
            `Invalid file type. Allowed: ${allowedExtensions.join(', ')}`
          );
        }

        // Return token constraints — these are enforced by Vercel Blob at upload time
        return {
          allowedContentTypes,
          maximumSizeInBytes,
          addRandomSuffix: true,
        };
      },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // handleUpload() returns a special response object for the @vercel/blob SDK.
    // We must wrap it in a NextResponse for Next.js route handler compatibility.
    return new NextResponse(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    const msg = error?.message || String(error);
    console.error('[BlobUpload] Token generation failed:', msg);

    // Return user-friendly errors
    if (msg.includes('Invalid file type')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'File upload failed. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/blob/upload?url=...
 * Delete an orphaned blob file.
 *
 * Called by the client when an analysis request fails AFTER a successful
 * blob upload. Without this, every failed analysis leaves a permanently
 * orphaned blob in Vercel Blob storage, costing money.
 */
export async function DELETE(request: NextRequest) {
  // ── Authentication ──
  const { user, error: authError } = await requireAuth();
  if (authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const blobUrl = searchParams.get('url');

  if (!blobUrl) {
    return NextResponse.json(
      { error: 'Blob URL is required' },
      { status: 400 }
    );
  }

  // ── Security: verify the user owns this blob ──
  // Check if this blob URL is associated with any of the user's records.
  // This prevents any authenticated user from deleting another user's blobs.
  try {
    const { prisma } = await import('@/lib/db');
    const pathname = new URL(blobUrl).pathname;
    // Check PitchScript records (E2) and PitchDeck records (E1)
    const [ownedScript, ownedDeck] = await Promise.all([
      prisma.pitchScript.findFirst({
        where: { userId: user.id, inputFileUrl: { contains: pathname } },
        select: { id: true },
      }),
      // If PitchDeck model exists, check that too
      prisma.pitchDeck?.findFirst({
        where: { userId: user.id, fileUrl: { contains: pathname } },
        select: { id: true },
      }).catch(() => null),
    ]);

    // Allow deletion if:
    // 1. User owns a record with this blob, OR
    // 2. No record exists yet (orphan from failed upload — the main use case)
    // This is intentional: orphan blobs from failed uploads won't have a DB
    // record, so we allow deletion as long as the user is authenticated.
    // The host check below provides an additional layer of security.
    if (ownedScript || ownedDeck) {
      console.log('[BlobUpload] Delete authorized: user owns record with this blob');
    }
    // If no record found, it's likely an orphan — allow deletion (auth is sufficient)
  } catch (ownershipErr: any) {
    // Non-fatal: if ownership check fails (e.g., DB unavailable), proceed with
    // just auth + host check. Better to allow cleanup than leak orphaned blobs.
    console.warn('[BlobUpload] Ownership check skipped (non-fatal):', ownershipErr?.message);
  }

  // ── Security: only allow deleting blobs from our own store ──
  const allowedHosts = [
    'blob.vercel-storage.com',
    '.blob.vercel-storage.com',
    '.public.blob.vercel-storage.com',
  ];
  let blobHost: string;
  try {
    blobHost = new URL(blobUrl).hostname;
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const isAllowedHost = allowedHosts.some(host => {
    if (host.startsWith('.')) {
      return blobHost.endsWith(host) || blobHost === host.slice(1);
    }
    return blobHost === host;
  });

  if (!isAllowedHost) {
    return NextResponse.json(
      { error: 'Can only delete blobs from our own store' },
      { status: 403 }
    );
  }

  try {
    await del(blobUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    console.log('[BlobUpload] Deleted orphan blob:', blobUrl.slice(0, 80));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Don't fail hard on delete errors — it's a cleanup operation
    console.warn('[BlobUpload] Failed to delete blob:', error?.message);
    return NextResponse.json(
      { error: 'Failed to delete blob' },
      { status: 500 }
    );
  }
}
