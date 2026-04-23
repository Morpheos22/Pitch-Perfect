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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Allow connections to Google AI / Gemini API from browser
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://blob.vercel-storage.com https://public.blob.vercel-storage.com",
              "font-src 'self'",
              "connect-src 'self' https://blob.vercel-storage.com https://public.blob.vercel-storage.com https://generativelanguage.googleapis.com https://*.aiplatform.googleapis.com https://z.ai https://api.upstash.com",
              "frame-src 'self' https://challenges.cloudflare.com",
              "media-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
