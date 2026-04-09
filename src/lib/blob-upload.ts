// src/lib/blob-upload.ts
// Client-side Blob upload utility.
// Bypasses the 4.5MB Vercel serverless body limit by uploading directly to Vercel Blob.
//
// Flow:
//   1. POST /api/blob/upload to get a signed client token + upload URL
//   2. PUT file directly to Vercel Blob storage (bypasses our server)
//   3. Return the public URL and pathname

export interface BlobUploadResult {
  url: string;       // Public download URL
  pathname: string;  // Blob pathname for reference
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
      "x-vercel-blob-access": "public",
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
