// src/lib/file-validation.ts
// Single source of truth for file validation across the entire application.
//
// Every module that validates file types, extensions, MIME types, or sizes
// MUST import from this file. No other file should define its own allowed
// formats, extensions, or size limits.
//
// Categories: deck, script, video
// Used by: blob-upload.ts, storage.ts, blob/upload/route.ts, file-parser.ts,
//          blob-signature.ts, new/page.tsx

export type FileCategory = 'deck' | 'script' | 'video';

/** Allowed extensions per category — the ONLY list in the codebase */
export const ALLOWED_EXTENSIONS: Record<FileCategory, string[]> = {
  deck: ['.pdf', '.pptx', '.ppt'],
  script: ['.docx', '.doc', '.txt'],
  video: ['.mp4', '.webm', '.mov', '.avi'],
};

/** Allowed MIME types per category — the ONLY list in the codebase */
export const ALLOWED_MIME_TYPES: Record<FileCategory, string[]> = {
  deck: [
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  script: [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/plain',
  ],
  video: [
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
  ],
};

/** Maximum file sizes per category in bytes — the ONLY list in the codebase */
export const MAX_FILE_SIZES: Record<FileCategory, number> = {
  deck: 50 * 1024 * 1024,   // 50MB
  script: 10 * 1024 * 1024,  // 10MB
  video: 500 * 1024 * 1024,  // 500MB
};

/** MIME type map for file extension → content type (used by file-parser and blob-signature) */
export const EXTENSION_TO_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppt: 'application/vnd.ms-powerpoint',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  txt: 'text/plain',
  md: 'text/markdown',
  text: 'text/plain',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  avi: 'video/x-msvideo',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/**
 * Validate a file's extension and MIME type against a category.
 * Throws with a user-friendly message if invalid.
 */
export function validateFileFormat(
  file: { name: string; type: string; size: number },
  category: FileCategory,
): void {
  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  const allowedExts = ALLOWED_EXTENSIONS[category];
  const allowedMimes = ALLOWED_MIME_TYPES[category];
  const maxSize = MAX_FILE_SIZES[category];

  if (!allowedExts.includes(ext)) {
    throw new Error(
      `Unsupported file format "${ext}". Accepted: ${allowedExts.join(', ')}`
    );
  }

  // Check MIME type if available (some browsers don't report it)
  // Note: Extension was already validated above, so here we only flag MIME
  // mismatches. A valid extension + invalid MIME means the browser detected
  // a different content type — worth warning about but not blocking if the
  // extension is legitimate (some browsers report incorrect MIME types).
  if (file.type && file.type !== 'application/octet-stream') {
    if (!allowedMimes.includes(file.type)) {
      // MIME doesn't match, but extension was already validated above.
      // Log a warning but don't block — browser MIME detection is unreliable.
      console.warn(
        `[FileValidation] MIME type "${file.type}" doesn't match expected types for category "${category}", but extension "${ext}" is valid. Proceeding.`
      );
    }
  }

  if (file.size > maxSize) {
    const maxMB = (maxSize / (1024 * 1024)).toFixed(0);
    throw new Error(
      `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum: ${maxMB}MB`
    );
  }
}

/**
 * Validate file type by category — returns result object instead of throwing.
 * Used by storage.ts server-side validation.
 */
export function validateFileTypeByCategory(
  fileName: string,
  mimeType: string,
  category: FileCategory,
): { valid: boolean; error?: string } {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  const allowedExts = ALLOWED_EXTENSIONS[category];
  const allowedMimes = ALLOWED_MIME_TYPES[category];

  // Extension MUST be in the allowed list — this is the primary check.
  if (!allowedExts.includes(ext)) {
    const categoryLabels: Record<FileCategory, string> = {
      deck: 'PDF or PowerPoint',
      script: 'Word or text',
      video: 'MP4, WebM, MOV, or AVI',
    };
    return {
      valid: false,
      error: `Invalid file type. Please upload a ${categoryLabels[category]} file.`,
    };
  }

  // MIME check: warn but don't block if MIME is unexpected.
  // Browsers and upload proxies sometimes report application/octet-stream
  // or other generic MIME types even for valid files. Since the extension
  // was already validated above, blocking on MIME alone would reject
  // legitimate uploads. This aligns with the client-side validateFileFormat()
  // which also treats MIME mismatches as warnings, not blockers.
  if (mimeType && mimeType !== 'application/octet-stream' && !allowedMimes.includes(mimeType)) {
    console.warn(
      `[FileValidation] MIME type "${mimeType}" not in allowed list for category "${category}", but extension "${ext}" is valid. Proceeding.`
    );
  }

  return { valid: true };
}

/**
 * Validate file size by category — returns result object instead of throwing.
 * Used by storage.ts server-side validation.
 */
export function validateFileSizeByCategory(
  size: number,
  category: FileCategory,
): { valid: boolean; error?: string } {
  const maxSize = MAX_FILE_SIZES[category];
  if (size > maxSize) {
    const limitMB = maxSize / (1024 * 1024);
    return { valid: false, error: `File size exceeds ${limitMB}MB limit.` };
  }
  return { valid: true };
}
