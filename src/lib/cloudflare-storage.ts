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

// R2 URL strategy — PRIVATE BY DEFAULT
//
// There are three possible R2 URL patterns:
//   1. R2_PUBLIC_DOMAIN — a custom domain like https://files.pitchcoachai.tech
//      (PUBLIC — anyone with the URL can read the file)
//   2. r2.dev — https://<bucket>.<account>.r2.dev
//      (PUBLIC if "Allow Access" is enabled on the bucket's r2.dev subdomain)
//   3. r2.cloudflarestorage.com — the S3-compatible API endpoint
//      (PRIVATE — always requires SigV4 signed requests)
//
// CONFIRMED: the R2 bucket has NO public domain attached and r2.dev
// access is disabled. So we ALWAYS use the internal S3 endpoint for
// upload/download operations. Files are ONLY accessible through the
// /api/blob/download proxy route, which enforces auth + ownership checks.
//
// The `url` field returned to clients is the proxy URL, not a direct
// R2 URL — so even if a URL leaks, it can't be accessed without auth.

const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN || "";
const R2_INTERNAL_URL = `https://${R2_BUCKET_NAME}.${CF_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// For S3-compatible operations (PUT/GET/DELETE with SigV4 signing),
// always use the internal endpoint. This works regardless of public
// access settings on the bucket.
const R2_BASE_URL = R2_INTERNAL_URL;

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

  // Return the PROXY URL — not a direct R2 URL. The proxy route
  // /api/blob/download enforces auth + ownership checks before serving
  // the file. This means even if the URL leaks, the file can't be
  // accessed without the authenticated user's session matching the
  // file's owner.
  const proxyUrl = `/api/blob/download?pathname=${encodeURIComponent(key)}`;

  return {
    url: proxyUrl,
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
 * Get the access URL for an R2 object.
 *
 * SECURITY: Always returns the /api/blob/download proxy URL, never a
 * direct R2 URL. The proxy route enforces auth + ownership checks.
 *
 * The R2_PUBLIC_DOMAIN env var is no longer used — it exists only for
 * backward compatibility with older code that may reference it. If set,
 * it is IGNORED (uploads/downloads always go through the internal S3
 * endpoint, and the returned URL is always the proxy).
 */
export function getR2PublicUrl(key: string): string {
  return `/api/blob/download?pathname=${encodeURIComponent(key)}`;
}

/**
 * Check if R2 is configured.
 */
export function isR2Configured(): boolean {
  return !!(CF_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
}
