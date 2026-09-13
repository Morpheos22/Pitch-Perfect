/**
 * Cloudflare R2 storage service — replaces Vercel Blob.
 *
 * R2 is S3-compatible object storage. This module provides the same interface
 * as the old Vercel Blob storage (upload, download, delete, sign).
 *
 * Env vars required:
 *   - CLOUDFLARE_ACCOUNT_ID
 *   - CLOUDFLARE_R2_ACCESS_KEY_ID
 *   - CLOUDFLARE_R2_SECRET_ACCESS_KEY
 *   - CLOUDFLARE_R2_BUCKET_NAME
 *
 * Files are stored in R2 and accessed via the R2 public URL or presigned URLs.
 */

import { createHash, createHmac } from "crypto";

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || "pitch-perfect";

// R2 public URL pattern
// - If R2_PUBLIC_DOMAIN is set (e.g., "https://files.pitchcoachai.tech"), use that
// - Otherwise, use the r2.dev pattern: https://pub-<hash>.r2.dev
// - Fallback: internal URL for authenticated proxy downloads
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "";
const R2_DEV_URL = `https://${R2_BUCKET_NAME}.${CF_ACCOUNT_ID}.r2.dev`;
const R2_INTERNAL_URL = `https://${R2_BUCKET_NAME}.${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Use custom domain if set, otherwise r2.dev, otherwise internal URL
const R2_BASE_URL = R2_PUBLIC_DOMAIN || R2_DEV_URL;

// ── AWS S3-compatible signature v4 for R2 ─────────────────────────────────
// R2 uses the same SigV4 signing as S3, but with a different host pattern.

function getAmzDate(): { amzDate: string; dateStamp: string } {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  return { amzDate, dateStamp };
}

function sigV4Sign(
  method: string,
  url: URL,
  headers: Record<string, string>,
  body: Buffer | string,
  accessKey: string,
  secretKey: string,
  region: string,
  service: string
): string {
  const { amzDate, dateStamp } = getAmzDate();
  const canonicalUri = url.pathname;
  const canonicalQueryString = url.search.slice(1);

  // Build canonical headers
  const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderKeys
    .map(k => `${k}:${headers[k] || (headers as any)[k.toUpperCase()]}\n`)
    .join("");
  const signedHeaders = signedHeaderKeys.join(";");

  // Payload hash
  const payloadHash = createHash("sha256").update(body || "").digest("hex");

  // Create canonical request
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  // Create string to sign
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");

  // Calculate signing key
  const kDate = createHmac("sha256", `AWS4${secretKey}`).update(dateStamp).digest();
  const kRegion = createHmac("sha256", kDate).update(region).digest();
  const kService = createHmac("sha256", kRegion).update(service).digest();
  const kSigning = createHmac("sha256", kService).update("aws4_request").digest();

  // Calculate signature
  const signature = createHmac("sha256", kSigning).update(stringToSign).digest("hex");

  // Build authorization header
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return authorization;
}

// ── Public API (matches old storage.ts interface) ─────────────────────────

export interface UploadResult {
  url: string;
  key: string;
  size: number;
  contentType: string;
}

/**
 * Upload a file to Cloudflare R2.
 * Replaces the old Vercel Blob upload() function.
 */
export async function uploadToR2(
  file: Buffer | Blob | ArrayBuffer,
  options: { filename?: string; contentType?: string; folder?: string } = {}
): Promise<UploadResult> {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CF_ACCOUNT_ID) {
    throw new Error("Cloudflare R2 not configured — set CLOUDFLARE_R2_* env vars");
  }

  const buffer = file instanceof Buffer ? file : Buffer.from(file as ArrayBuffer);
  const contentType = options.contentType || "application/octet-stream";
  const folder = options.folder || "uploads";
  const filename = options.filename || `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  const key = `${folder}/${filename}`;

  const url = new URL(`${R2_BASE_URL}/${key}`);
  const { amzDate } = getAmzDate();

  const headers: Record<string, string> = {
    "Host": url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": createHash("sha256").update(buffer).digest("hex"),
    "Content-Type": contentType,
    "Content-Length": String(buffer.length),
  };

  const authorization = sigV4Sign(
    "PUT",
    url,
    headers,
    buffer,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    "auto",
    "s3"
  );

  headers["Authorization"] = authorization;

  const response = await fetch(url.toString(), {
    method: "PUT",
    headers,
    body: new Uint8Array(buffer),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`R2 upload failed ${response.status}: ${errText.slice(0, 200)}`);
  }

  // Return the public URL — uses custom domain if set, otherwise r2.dev
  const publicUrl = R2_PUBLIC_DOMAIN
    ? `${R2_PUBLIC_DOMAIN}/${key}`
    : `${R2_DEV_URL}/${key}`;

  return {
    url: publicUrl,
    key,
    size: buffer.length,
    contentType,
  };
}

/**
 * Download a file from Cloudflare R2 by key.
 * Replaces the old Vercel Blob download() function.
 */
export async function downloadFromR2(key: string): Promise<{ data: Buffer; contentType: string }> {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CF_ACCOUNT_ID) {
    throw new Error("Cloudflare R2 not configured");
  }

  const url = new URL(`${R2_BASE_URL}/${key}`);
  const { amzDate } = getAmzDate();

  const headers: Record<string, string> = {
    "Host": url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": createHash("sha256").update("").digest("hex"),
  };

  const authorization = sigV4Sign(
    "GET",
    url,
    headers,
    "",
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    "auto",
    "s3"
  );

  headers["Authorization"] = authorization;

  const response = await fetch(url.toString(), { method: "GET", headers });

  if (!response.ok) {
    throw new Error(`R2 download failed ${response.status}`);
  }

  const data = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "application/octet-stream";

  return { data, contentType };
}

/**
 * Delete a file from Cloudflare R2.
 */
export async function deleteFromR2(key: string): Promise<void> {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !CF_ACCOUNT_ID) {
    throw new Error("Cloudflare R2 not configured");
  }

  const url = new URL(`${R2_BASE_URL}/${key}`);
  const { amzDate } = getAmzDate();

  const headers: Record<string, string> = {
    "Host": url.host,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": createHash("sha256").update("").digest("hex"),
  };

  const authorization = sigV4Sign(
    "DELETE",
    url,
    headers,
    "",
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    "auto",
    "s3"
  );

  headers["Authorization"] = authorization;

  const response = await fetch(url.toString(), { method: "DELETE", headers });

  if (!response.ok && response.status !== 404) {
    throw new Error(`R2 delete failed ${response.status}`);
  }
}

/**
 * Get the public URL for an R2 object.
 * Uses custom domain if R2_PUBLIC_DOMAIN is set, otherwise r2.dev pattern.
 */
export function getR2PublicUrl(key: string): string {
  if (R2_PUBLIC_DOMAIN) {
    return `${R2_PUBLIC_DOMAIN}/${key}`;
  }
  return `${R2_DEV_URL}/${key}`;
}

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
  return !!(CF_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}
