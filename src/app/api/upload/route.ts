// API Route: File Upload
// POST /api/upload - Handles file uploads via Zoho WorkDrive storage
//
// LIMITS:
//   - Max 5 files per upload
//   - Max 50MB total combined
//   - Allowed types: PDF, PPTX, PPT, DOCX, DOC, HTML, TXT

import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateUser } from '@/lib/db-operations';
import { uploadFile, validateFileTypeByCategory, validateFileSizeByCategory } from '@/lib/storage';

const MAX_FILES_PER_UPLOAD = 5;
const MAX_TOTAL_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

const ALLOWED_EXTENSIONS = [
  '.pdf', '.pptx', '.ppt', '.docx', '.doc', '.html', '.txt',
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/html',
  'text/plain',
];

export async function POST(request: NextRequest) {
  try {
    const user = await getOrCreateUser();

    const formData = await request.formData();
    const type = formData.get('type') as 'deck' | 'script' | 'video' | null;

    // Collect all files from the form data
    const files: File[] = [];
    for (const [key, value] of formData.entries()) {
      if (value instanceof File && key === 'file') {
        files.push(value);
      }
    }

    // Also handle single file from formData.get('file')
    const singleFile = formData.get('file') as File | null;
    if (singleFile && !files.includes(singleFile)) {
      files.unshift(singleFile);
    }

    // Deduplicate by object identity
    const uniqueFiles = [...new Set(files)];

    if (uniqueFiles.length === 0) {
      return NextResponse.json({ error: 'At least one file is required' }, { status: 400 });
    }

    if (uniqueFiles.length > MAX_FILES_PER_UPLOAD) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FILES_PER_UPLOAD} files allowed per upload. You uploaded ${uniqueFiles.length} files.` },
        { status: 400 }
      );
    }

    if (!type || !['deck', 'script', 'video'].includes(type)) {
      return NextResponse.json({ error: 'Valid type (deck, script, video) is required' }, { status: 400 });
    }

    // Calculate total size
    const totalSize = uniqueFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_SIZE_BYTES) {
      const totalMB = (totalSize / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { error: `Total upload size (${totalMB}MB) exceeds the 50MB limit.` },
        { status: 400 }
      );
    }

    // Validate each file
    for (const file of uniqueFiles) {
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext) && !ALLOWED_MIME_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: "${file.name}". Allowed types: PDF, PPTX, PPT, DOCX, DOC, HTML, TXT` },
          { status: 400 }
        );
      }

      // Per-file category validation (size limits per category still apply)
      const typeValidation = validateFileTypeByCategory(file.name, file.type, type);
      if (!typeValidation.valid) {
        return NextResponse.json({ error: `${file.name}: ${typeValidation.error}` }, { status: 400 });
      }

      const sizeValidation = validateFileSizeByCategory(file.size, type);
      if (!sizeValidation.valid) {
        return NextResponse.json({ error: `${file.name}: ${sizeValidation.error}` }, { status: 400 });
      }
    }

    // Upload all files
    const results = await Promise.all(
      uniqueFiles.map(async (file) => {
        try {
          return await uploadFile(file, user.id, type, file.name, file.type);
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Upload failed';
          return { error: message, fileName: file.name };
        }
      })
    );

    const successes = results.filter((r): r is NonNullable<typeof r> & { key: string; url: string; fileName: string; fileSize: number; fileType: string } => !('error' in r));
    const failures = results.filter((r): r is { error: string; fileName: string } => 'error' in r);

    return NextResponse.json({
      success: failures.length === 0,
      files: successes.map((s) => ({
        key: s.key,
        url: s.url,
        fileName: s.fileName,
        fileSize: s.fileSize,
        fileType: s.fileType,
      })),
      errors: failures.length > 0 ? failures.map((f) => `${f.fileName}: ${f.error}`) : undefined,
      summary: {
        uploaded: successes.length,
        failed: failures.length,
        totalSize,
        totalSizeMB: `${(totalSize / (1024 * 1024)).toFixed(1)}MB`,
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
