import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // Ensure @vercel/blob/client is properly transpiled for browser usage.
  // The client subpath uses Node.js modules (undici, crypto) that must be
  // replaced with browser-compatible versions via the package's "browser" field.
  transpilePackages: ["@vercel/blob"],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'workdrive.zoho.com' },
    ],
  },
  serverExternalPackages: [
    "z-ai-web-dev-sdk",
    "resend",
    "pdf-parse",
    "mammoth",
    "jszip",
  ],
};

export default nextConfig;
