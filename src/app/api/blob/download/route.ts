// GET /api/blob/download?pathname=...
// Serves private Vercel Blob content to authenticated users.
// This proxy route ensures only authorized users can access private blobs.
//
// Flow:
//   1. Verify Clerk authentication
//   2. Verify user owns the blob (check all DB tables)
//   3. Fetch blob content using @vercel/blob SDK with BLOB_READ_WRITE_TOKEN
//   4. Stream response to client

import { NextRequest } from "next/server";
import { servePrivateBlob } from "@/lib/blob-signature";

export async function GET(request: NextRequest) {
  return servePrivateBlob(request);
}
