// POST /api/blob/upload
// Uploads files to Cloudflare R2 (replaces @vercel/blob handleUpload).
// Called by client-side uploadFileToBlob() in @/lib/blob-upload.ts.

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToR2 } from "@/lib/cloudflare-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Verify auth
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse multipart form data
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const folder = (formData.get("folder") as string) || "uploads";

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadToR2(buffer, {
      filename: file.name,
      contentType: file.type,
      folder: `${folder}/${userId}`,
    });

    return NextResponse.json({
      url: result.url,
      key: result.key,
      pathname: result.key,
      size: result.size,
      contentType: result.contentType,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Upload failed", detail: String(err).slice(0, 200) },
      { status: 500 }
    );
  }
}
