import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/db";

// POST /api/blob/upload
// Generates a signed client token for client-side Blob upload.
// The client uses this token to PUT the file directly to Vercel Blob storage,
// bypassing the 4.5MB Vercel serverless body limit.
//
// Requires Clerk authentication. Entitlement is enforced downstream at the
// analysis routes (deck, script, full), not here — a user may upload a file
// once and later use it across multiple modules.

export async function POST(request: Request) {
  try {
    // ── Auth guard ──
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

    const body = await request.json();
    const { fileName, fileType, category } = body;

    if (!fileName || !category) {
      return NextResponse.json(
        { error: "fileName and category are required" },
        { status: 400 }
      );
    }

    const validCategories = ["deck", "script", "video"];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate a unique pathname for the blob
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const pathname = `${category}/${timestamp}-${random}-${sanitizedName}`;

    // Generate a client token using @vercel/blob
    const { generateClientTokenFromReadWriteToken } = await import("@vercel/blob/client");

    const clientToken = await (generateClientTokenFromReadWriteToken as any)({
      pathname,
      access: "public",
      addRandomSuffix: true,
      maximumSizeInBytes: category === "video" ? 500 * 1024 * 1024 : 50 * 1024 * 1024,
      validUntil: Date.now() + 60 * 60 * 1000, // 1 hour from now
    });

    return NextResponse.json({
      pathname,
      clientToken,
      uploadUrl: `https://vercel.com/api/blob/?pathname=${encodeURIComponent(pathname)}`,
    });
  } catch (error) {
    console.error("[Blob Upload] Failed to generate upload token:", error);
    return NextResponse.json(
      { error: "Failed to generate upload token" },
      { status: 500 }
    );
  }
}
