// GET /api/blob/download?pathname=...
// Serves R2 blob content to authenticated users.
// This proxy route ensures only authorized users can access blob files.

import { NextRequest, NextResponse } from "next/server";
import { downloadFromR2 } from "@/lib/cloudflare-storage";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const pathname = request.nextUrl.searchParams.get('pathname');
  if (!pathname) {
    return NextResponse.json({ error: 'missing pathname' }, { status: 400 });
  }

  try {
    const { data, contentType } = await downloadFromR2(pathname);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(data.length),
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'File not found', detail: String(err).slice(0, 100) },
      { status: 404 }
    );
  }
}
