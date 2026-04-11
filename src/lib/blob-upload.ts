// src/lib/blob-upload.ts
// Client-side Blob upload utility.
// Bypasses the 4.5MB Vercel serverless body limit by uploading directly to Vercel Blob.
//
// Flow:
//   1. POST /api/blob/upload to get a signed client token + upload URL
//   2. PUT file directly to Vercel Blob storage (bypasses our server)
//   3. Return the blob pathname (private access — use blob-signature.ts for download URLs)

// Allowed file formats per category — enforced client-side BEFORE upload
const ALLOWED_FORMATS: Record<string, { extensions: string[]; mimeTypes: string[]; maxSize: number }> = {
  deck: {
    extensions: [".pdf", ".pptx", ".ppt"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  script: {
    extensions: [".pdf", ".docx", ".doc", ".txt"],
    mimeTypes: [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
      "text/plain",
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
  },
  video: {
    extensions: [".mp4", ".webm", ".mov", ".avi"],
    mimeTypes: [
      "video/mp4",
      "video/webm",
      "video/quicktime",
      "video/x-msvideo",
    ],
    maxSize: 500 * 1024 * 1024, // 500MB
  },
};

/**
 * Validate file format before upload. Throws if invalid.
 */
export function validateFileFormat(file: File, category: "deck" | "script" | "video"): void {
  const format = ALLOWED_FORMATS[category];
  if (!format) {
    throw new Error(`Unknown upload category: ${category}`);
  }

  const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));
  if (!format.extensions.includes(ext)) {
    throw new Error(
      `Unsupported file format "${ext}". Accepted: ${format.extensions.join(", ")}`
    );
  }

  // Check MIME type if available (some browsers don't report it)
  if (file.type && file.type !== "application/octet-stream") {
    if (!format.mimeTypes.includes(file.type) && !format.extensions.includes(ext)) {
      throw new Error(
        `Invalid file type "${file.type}". Accepted: ${format.extensions.join(", ")}`
      );
    }
  }

  if (file.size > format.maxSize) {
    const maxMB = (format.maxSize / (1024 * 1024)).toFixed(0);
    throw new Error(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum: ${maxMB}MB`);
  }
}

export interface BlobUploadResult {
  url: string;       // Blob pathname (for reference — not directly accessible)
  pathname: string;  // Blob pathname for signed URL generation
}

export interface BlobUploadOptions {
  /** Callback for upload progress ({ loaded, total, percentage }) */
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
}

/**
 * Upload a file to Vercel Blob storage via client-side direct upload.
 * This bypasses the Vercel serverless 4.5MB body limit.
 */
export async function uploadFileToBlob(
  file: File,
  category: "deck" | "script" | "video",
  options?: BlobUploadOptions
): Promise<BlobUploadResult> {
  // Validate file format before uploading
  validateFileFormat(file, category);

  // Step 1: Get signed upload token from our API
  const tokenRes = await fetch("/api/blob/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      category,
    }),
  });

  if (!tokenRes.ok) {
    const data = await tokenRes.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || "Failed to get upload URL"
    );
  }

  const { pathname, clientToken, uploadUrl } = (await tokenRes.json()) as {
    pathname: string;
    clientToken: string;
    uploadUrl: string;
  };

  // Step 2: Upload file directly to Vercel Blob storage
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      authorization: `Bearer ${clientToken}`,
      "x-vercel-blob-access": "private",
      "x-content-type": file.type || "application/octet-stream",
      ...(options?.onProgress
        ? { "x-content-length": String(file.size) }
        : {}),
    },
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text().catch(() => "");
    throw new Error(
      `Failed to upload file to storage (${uploadRes.status}): ${errorText}`
    );
  }

  // Step 3: Parse response to get the public URL
  const uploadData = (await uploadRes.json().catch(() => null)) as {
    url?: string;
    pathname?: string;
    downloadUrl?: string;
  } | null;

  // The Blob API returns the final URL in the response body
  const publicUrl =
    uploadData?.url ||
    uploadData?.downloadUrl ||
    `https://public.blob.vercel-storage.com${pathname}`;

  return {
    url: publicUrl,
    pathname: uploadData?.pathname || pathname,
  };
}
