// GET /api/blob/download?pathname=...
// Serves R2 blob content to authenticated users.
//
// SECURITY: Every download is authorized through an ownership check.
// The pathname MUST start with `${folder}/${userId}/` — i.e. the blob
// must belong to the calling user. Any attempt to read another user's
// file returns 403.
//
// This closes the previous vulnerability where any authenticated user
// could read any other user's file by guessing/enumerating pathnames.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { downloadFromR2 } from "@/lib/cloudflare-storage";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // ── 1. Require authentication ──────────────────────────────────────────
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pathname = request.nextUrl.searchParams.get("pathname");
  if (!pathname) {
    return NextResponse.json({ error: "missing pathname" }, { status: 400 });
  }

  // ── 2. Path traversal guard ────────────────────────────────────────────
  // Reject any pathname containing ".." or starting with "/" — these are
  // attempts to escape the user's namespace or access absolute paths.
  const normalized = pathname.replace(/^\/+/, "");
  if (normalized.includes("..") || normalized !== pathname.replace(/^\/+/, "")) {
    return NextResponse.json({ error: "Invalid pathname" }, { status: 400 });
  }

  // ── 3. Resolve the internal user ID from Clerk ID ─────────────────────
  // The blob pathname contains the internal user.id (cuid), not the Clerk
  // clerkId. We need to look it up to perform the ownership check.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // ── 4. Ownership check ─────────────────────────────────────────────────
  // Blob pathnames are structured as `${folder}/${userId}/${filename}`.
  // The userId segment MUST match the authenticated user's internal ID.
  // This is the core authorization — without it, any user could read any
  // other user's uploads by guessing pathnames.
  const pathParts = normalized.split("/");
  if (pathParts.length < 3) {
    return NextResponse.json(
      { error: "Invalid pathname format" },
      { status: 400 },
    );
  }
  const ownerIdInPath = pathParts[1];
  if (ownerIdInPath !== user.id) {
    // Log the unauthorized attempt for security forensics
    console.warn(
      `[blob/download] Unauthorized access attempt: clerkId=${clerkId} ` +
        `userId=${user.id} tried to access pathname owned by ${ownerIdInPath}`,
    );
    return NextResponse.json(
      { error: "Forbidden — you do not own this file" },
      { status: 403 },
    );
  }

  // ── 5. Download from R2 ────────────────────────────────────────────────
  try {
    const { data, contentType } = await downloadFromR2(pathname);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(data.length),
        // private = only the end user's browser may cache; no shared/CDN cache
        "Cache-Control": "private, max-age=3600",
        // Defensive: prevent the browser from sniffing a different content type
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "File not found", detail: String(err).slice(0, 100) },
      { status: 404 },
    );
  }
}
