// src/lib/blob-signature.ts
// Utilities for handling Vercel Blob access.
//
// This project uses a PUBLIC Vercel Blob store. Public blobs are accessible
// by their URL directly. The SDK get() function with access: 'public' can also
// be used server-side for programmatic access.
//
// This module provides:
//   - extractBlobPathname: Parse blob URLs to get the pathname
//   - fetchBlob: Server-side fetch of blob content via SDK (public + private access)
//   - generateBlobDownloadUrl: Generate a URL to our proxy route for client access

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { EXTENSION_TO_MIME } from "@/lib/file-validation";

/**
 * Extract the blob pathname from a full Vercel Blob URL.
 * Handles both public and private blob URL formats.
 *
 * @param blobUrl - Full blob URL like "https://<store-slug>.blob.vercel-storage.com/deck/1234-file.pdf"
 * @returns The pathname portion (e.g. "deck/1234-file.pdf") or null if not parseable
 */
export function extractBlobPathname(blobUrl: string): string | null {
  try {
    const url = new URL(blobUrl);
    const pathname = url.pathname.startsWith("/")
      ? url.pathname.slice(1)
      : url.pathname;
    return pathname || null;
  } catch {
    return null;
  }
}

/** Validate a pathname before using it as a blob identifier. */
export function isSafeBlobPathname(pathname: string): boolean {
  if (!pathname || pathname.length > 1024 || pathname.startsWith('/')) {
    return false;
  }

  try {
    const decoded = decodeURIComponent(pathname);
    return !decoded.includes('\\') && !decoded.split('/').some(segment => segment === '..' || segment === '.');
  } catch {
    return false;
  }
}

/**
 * Fetch the content of a blob server-side using the @vercel/blob SDK.
 * Uses access: 'public' because the Vercel Blob store for this project is public.
 * Requires BLOB_READ_WRITE_TOKEN to be set in environment variables for SDK initialization.
 *
 * @param blobUrlOrPathname - Either a full blob URL or a blob pathname
 * @returns Buffer with the file content
 */
export async function fetchBlob(blobUrlOrPathname: string): Promise<Buffer> {
  const { get } = await import("@vercel/blob");

  console.log(`[Blob] fetchBlob: fetching '${blobUrlOrPathname.substring(0, 80)}'`);

  const result = await get(blobUrlOrPathname, {
    access: "public",
  });

  // get() returns a discriminated union on statusCode:
  //   200 → stream is ReadableStream<Uint8Array>
  //   304 → stream is null (Not Modified)
  //   null → blob not found
  if (!result) {
    throw new Error(`Blob not found: ${blobUrlOrPathname}`);
  }

  // Check for 304 Not Modified (stream is null)
  if (result.statusCode === 304 || !result.stream) {
    throw new Error(`Blob returned status ${result.statusCode} with no content stream for: ${blobUrlOrPathname}`);
  }

  const blobSize = result.blob?.size;
  console.log(`[Blob] Streaming blob content, reported size: ${blobSize} bytes`);

  // Read the stream into a buffer
  const reader = result.stream.getReader();
  const chunks: Uint8Array[] = [];
  let totalLength = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalLength += value.length;
  }

  const buffer = Buffer.alloc(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }

  console.log(`[Blob] Buffered ${buffer.length} bytes from blob`);
  return buffer;
}

/**
 * Check if a URL is a Vercel Blob URL.
 * Handles subdomain format: https://<store-slug>.blob.vercel-storage.com/...
 * and https://<store-slug>.public.blob.vercel-storage.com/...
 *
 * This is the SINGLE source of truth for blob URL detection.
 * All routes should import this instead of inlining their own checks.
 */
export function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith('.blob.vercel-storage.com') ||
      parsed.hostname === 'blob.vercel-storage.com'
    );
  } catch {
    return false;
  }
}

/**
 * Check if a URL is a PRIVATE Vercel Blob URL (non-public).
 * Private blob URLs end with .blob.vercel-storage.com but NOT .public.blob.vercel-storage.com
 *
 * This is the SINGLE source of truth for private blob detection.
 * Coach routes should import this instead of inlining their own checks.
 */
export function isPrivateBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname.endsWith('.blob.vercel-storage.com') ||
        parsed.hostname === 'blob.vercel-storage.com') &&
      !parsed.hostname.endsWith('.public.blob.vercel-storage.com')
    );
  } catch {
    return false;
  }
}

/**
 * Generate a URL to our /api/blob/download proxy route for client-side access.
 * The proxy route handles authentication and serves private blob content.
 *
 * @param blobUrlOrPathname - The stored blob URL or pathname
 * @returns A URL string pointing to our proxy route
 */
export function generateBlobDownloadUrl(blobUrlOrPathname: string): string {
  const pathname = isBlobUrl(blobUrlOrPathname)
    ? extractBlobPathname(blobUrlOrPathname) || blobUrlOrPathname
    : blobUrlOrPathname;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  return `${appUrl}/api/blob/download?pathname=${encodeURIComponent(pathname)}`;
}

/**
 * Convert a blob URL to a data URI for AI vision models.
 * The AI gateway cannot fetch blob URLs directly in some cases — it needs
 * either a public URL or a data URI. This function fetches the blob
 * content server-side (using fetchBlob with public access) and converts it
 * to a base64 data URI that can be passed directly to the AI vision endpoint.
 *
 * For public blob stores, the URL is already publicly accessible, but converting
 * to a data URI ensures the AI gateway can always access the content regardless
 * of network restrictions.
 *
 * @param blobUrlOrPathname - The stored blob URL or pathname
 * @returns A data URI string (e.g. "data:application/pdf;base64,...") or null on failure
 */
export async function blobUrlToDataUri(blobUrlOrPathname: string): Promise<string | null> {
  try {
    const pathname = isBlobUrl(blobUrlOrPathname)
      ? extractBlobPathname(blobUrlOrPathname) || blobUrlOrPathname
      : blobUrlOrPathname;

    // Fetch the blob content using the SDK (public access)
    const buffer = await fetchBlob(pathname);

    // Determine content type from pathname extension (single source of truth)
    const ext = pathname.split('.').pop()?.toLowerCase() || '';
    const contentType = EXTENSION_TO_MIME[ext] || 'application/octet-stream';

    // Convert to base64 data URI
    const base64 = buffer.toString('base64');
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.warn('[Blob] Failed to convert blob URL to data URI:', error);
    return null;
  }
}

/**
 * Verify that a blob pathname belongs to the authenticated user.
 * Checks the database for any record (PitchDeck, PitchScript, PitchVideo, FullPitchSession)
 * that references a URL containing the given pathname.
 *
 * Used by the blob download proxy route to prevent unauthorized access.
 */
export async function verifyBlobOwnership(
  userId: string,
  pathname: string
): Promise<boolean> {
  // Search across all tables that may contain blob URLs
  const [
    decks,
    scripts,
    videos,
    fullSessions,
  ] = await Promise.all([
    prisma.pitchDeck.findMany({
      where: { userId, fileUrl: { contains: pathname } },
      select: { fileUrl: true },
    }),
    prisma.pitchScript.findMany({
      where: { userId, inputFileUrl: { contains: pathname } },
      select: { inputFileUrl: true },
    }),
    prisma.pitchVideo.findMany({
      where: {
        userId,
        OR: [
          { videoUrl: { contains: pathname } },
          { r2Key: { contains: pathname } },
        ],
      },
      select: { videoUrl: true, r2Key: true },
    }),
    prisma.fullPitchSession.findMany({
      where: { userId, videoUrl: { contains: pathname } },
      select: { videoUrl: true },
    }),
  ]);

  // The queries use broad candidates for compatibility with full URLs and
  // legacy path keys, but authorization requires an exact pathname match.
  const references = [
    ...decks.map(record => record.fileUrl),
    ...scripts.map(record => record.inputFileUrl),
    ...videos.flatMap(record => [record.videoUrl, record.r2Key]),
    ...fullSessions.map(record => record.videoUrl),
  ];

  return references.some(reference => {
    if (!reference) return false;
    return reference === pathname || extractBlobPathname(reference) === pathname;
  });
}

/**
 * Serve a private blob as a streaming response.
 * Used by /api/blob/download proxy route.
 *
 * @param request - The incoming NextRequest
 * @returns A NextResponse with the blob content or an error
 */
export async function servePrivateBlob(request: NextRequest): Promise<NextResponse> {
  try {
    // Auth check
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Extract pathname from query
    const { searchParams } = new URL(request.url);
    const pathname = searchParams.get("pathname");

    if (!pathname || !isSafeBlobPathname(pathname)) {
      return NextResponse.json(
        { error: "Invalid pathname" },
        { status: 400 }
      );
    }

    // Verify user owns this blob
    const isOwner = await verifyBlobOwnership(user.id, pathname);
    if (!isOwner) {
      return NextResponse.json(
        { error: "You don't have access to this file" },
        { status: 403 }
      );
    }

    // Fetch blob content using SDK (public access — store is public)
    const buffer = await fetchBlob(pathname);

    // Determine content type from pathname extension (single source of truth)
    const ext = pathname.split(".").pop()?.toLowerCase() || "";
    const contentType = EXTENSION_TO_MIME[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Blob Download] Failed to serve blob:", error);
    return NextResponse.json(
      { error: "Failed to retrieve file" },
      { status: 500 }
    );
  }
}
