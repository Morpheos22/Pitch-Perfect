// API Route: File Upload
// POST /api/upload - Handles file uploads for R2 storage

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db-operations';
import { uploadFile, validateFileType, validateFileSize } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateUser();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as 'deck' | 'script' | 'video' | null;

    if (!file) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (!type || !['deck', 'script', 'video'].includes(type)) {
      return NextResponse.json({ error: 'Valid type (deck, script, video) is required' }, { status: 400 });
    }

    // Validate file type
    const typeValidation = validateFileType(file.name, file.type, type);
    if (!typeValidation.valid) {
      return NextResponse.json({ error: typeValidation.error }, { status: 400 });
    }

    // Validate file size
    const sizeValidation = validateFileSize(file.size, type);
    if (!sizeValidation.valid) {
      return NextResponse.json({ error: sizeValidation.error }, { status: 400 });
    }

    // Upload file
    const result = await uploadFile(
      file,
      user.id,
      type,
      file.name,
      file.type
    );

    return NextResponse.json({
      success: true,
      file: {
        key: result.key,
        url: result.url,
        fileName: result.fileName,
        fileSize: result.fileSize,
        fileType: result.fileType,
      },
    });

  } catch (error) {
    console.error('Upload API error:', error);
    
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Upload failed', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
