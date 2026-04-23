// GET /api/blob/download?pathname=...
// Serves Vercel Blob content to authenticated users.
// This proxy route ensures only authorized users can access blob files,
// even though the blob store is public (public URLs have random suffixes
// for security, but this adds an extra auth layer for direct downloads).
//
// Flow:
//   1. Verify Clerk authentication
//   2. Verify user owns the blob (check all DB tables)
//   3. Fetch blob content using @vercel/blob SDK with BLOB_READ_WRITE_TOKEN
//   4. Stream response to client


import { NextRequest } from "next/server";
import { servePrivateBlob } from "@/lib/blob-signature";
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return servePrivateBlob(request);
}
