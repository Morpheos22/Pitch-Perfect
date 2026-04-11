// src/lib/blob-signature.ts
// Utilities for handling private Vercel Blob access.
//
// When blob access is set to 'private', files cannot be accessed by direct URL.
// This module provides:
//   - extractBlobPathname: Parse blob URLs to get the pathname
//   - fetchPrivateBlob: Server-side fetch of private blob content via SDK
//   - generateBlobDownloadUrl: Generate a URL to our proxy route for client access

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Extract the blob pathname from a full Vercel Blob URL.
 * Handles both public and private blob URL formats.
 *
 * @param blobUrl - Full blob URL like "https://blob.vercel-storage.com/deck/1234-file.pdf"
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

/**
 * Fetch the content of a private blob server-side using the @vercel/blob SDK.
 * Requires BLOB_READ_WRITE_TOKEN to be set in environment variables.
 *
 * @param blobUrlOrPathname - Either a full blob URL or a blob pathname
 * @returns Buffer with the file content
 */
export async function fetchPrivateBlob(blobUrlOrPathname: string): Promise<Buffer> {
  const { get } = await import("@vercel/blob");

  const result = await get(blobUrlOrPathname, {
    access: "private",
  });

  if (!result || !result.stream) {
    throw new Error(`Blob not found: ${blobUrlOrPathname}`);
  }

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

  return buffer;
}

/**
 * Check if a URL is a Vercel Blob URL.
 */
function isBlobUrl(url: string): boolean {
  return (
    url.startsWith("https://blob.vercel-storage.com") ||
    url.startsWith("https://public.blob.vercel-storage.com")
  );
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
 * Convert a private blob URL to a data URI for AI vision models.
 * The AI gateway cannot fetch private blob URLs directly — it needs
 * either a public URL or a data URI. This function fetches the blob
 * content server-side (using the SDK with BLOB_READ_WRITE_TOKEN) and
 * converts it to a base64 data URI that can be passed directly to
 * the AI vision endpoint.
 *
 * @param blobUrlOrPathname - The stored blob URL or pathname
 * @returns A data URI string (e.g. "data:application/pdf;base64,...") or null on failure
 */
export async function blobUrlToDataUri(blobUrlOrPathname: string): Promise<string | null> {
  try {
    const pathname = isBlobUrl(blobUrlOrPathname)
      ? extractBlobPathname(blobUrlOrPathname) || blobUrlOrPathname
      : blobUrlOrPathname;

    // Fetch the private blob content using the SDK
    const buffer = await fetchPrivateBlob(pathname);

    // Determine content type from pathname extension
    const ext = pathname.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ppt: 'application/vnd.ms-powerpoint',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      mp4: 'video/mp4',
      webm: 'video/webm',
    };
    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';

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
async function verifyBlobOwnership(
  userId: string,
  pathname: string
): Promise<boolean> {
  // Search across all tables that may contain blob URLs
  const [
    deck,
    script,
    video,
    fullSession,
  ] = await Promise.all([
    prisma.pitchDeck.findFirst({
      where: { userId, fileUrl: { contains: pathname } },
      select: { id: true },
    }),
    prisma.pitchScript.findFirst({
      where: { userId, inputFileUrl: { contains: pathname } },
      select: { id: true },
    }),
    prisma.pitchVideo.findFirst({
      where: {
        userId,
        OR: [
          { videoUrl: { contains: pathname } },
          { r2Key: { contains: pathname } },
        ],
      },
      select: { id: true },
    }),
    prisma.fullPitchSession.findFirst({
      where: { userId, videoUrl: { contains: pathname } },
      select: { id: true },
    }),
  ]);

  return !!(deck || script || video || fullSession);
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

    if (!pathname) {
      return NextResponse.json(
        { error: "pathname is required" },
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

    // Fetch blob content using SDK
    const buffer = await fetchPrivateBlob(pathname);

    // Determine content type from pathname extension
    const ext = pathname.split(".").pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      ppt: "application/vnd.ms-powerpoint",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      doc: "application/msword",
      txt: "text/plain",
      mp4: "video/mp4",
      webm: "video/webm",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
    };

    const contentType = mimeTypes[ext || ""] || "application/octet-stream";

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
