import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'workdrive.zoho.com' },
    ],
  },
  serverExternalPackages: [
    "sharp",
    "z-ai-web-dev-sdk",
    "resend",
    "pdf-parse",
    "mammoth",
    "jszip",
  ],
};

export default nextConfig;
