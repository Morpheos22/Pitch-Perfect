import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextConfig: any = {
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
    "pdfjs-dist",
    "mammoth",
    "jszip",
  ],

  // ── Body size limits for large file uploads ──
  // proxyClientMaxBodySize handles proxy/middleware body size (replaces deprecated middlewareClientMaxBodySize).
  // serverActions.bodySizeLimit is a top-level config in Next.js 16+ (no longer under experimental).
  experimental: {
    proxyClientMaxBodySize: '50mb',
  },
  serverActions: {
    bodySizeLimit: '35mb',
  },

  // ── Unified security headers ──
  // Previously split between next.config.ts and vercel.json with conflicting CSPs.
  // Now consolidated here as the SINGLE source of truth.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Consolidated CSP — merged from both next.config.ts and vercel.json
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Script sources: Clerk auth, Cloudflare challenges, analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev https://cdn.clerk.com https://challenges.cloudflare.com https://static.cloudflareinsights.com",
              // Style sources: Google Fonts, Clerk
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev",
              // Font sources
              "font-src 'self' https://fonts.gstatic.com",
              // Image sources: blobs, data URIs, any HTTPS (for deck screenshots)
              "img-src 'self' data: https: blob:",
              // Connect sources: Clerk API, Z.ai, Vercel Blob, Google AI, Upstash, Zoho, Resend
              // SECURITY: Internal IP (172.25.x.x) only included in development.
              // Production uses ZAI_BASE_URL env var — never expose private IPs in CSP.
              [
                "'self'",
                process.env.NODE_ENV === 'development' && process.env.ZAI_BASE_URL?.startsWith('http://') ? process.env.ZAI_BASE_URL : '',
                'https://api.clerk.com',
                'https://*.clerk.com',
                'https://*.clerk.accounts.dev',
                'https://clerk.telemetry.cloudflare.com',
                'https://clerk.com',
                'https://z.ai',
                'https://blob.vercel-storage.com',
                'https://*.blob.vercel-storage.com',
                'https://*.public.blob.vercel-storage.com',
                'https://*.vercel-storage.com',
                'https://generativelanguage.googleapis.com',
                'https://*.aiplatform.googleapis.com',
                'https://api.upstash.com',
                'https://*.zoho.com',
                'https://resend.com',
              ].filter(Boolean).join(' '),
              // Frame sources: Clerk auth iframe, Cloudflare challenge
              "frame-src 'self' https://challenges.cloudflare.com https://clerk.com https://*.clerk.accounts.dev",
              // Media sources: audio/video playback for TTS and video analysis
              "media-src 'self' blob:",
              // Worker sources: blob workers for client-side processing
              "worker-src 'self' blob:",
            ].join('; '),
          },
          // Standard security headers
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        ],
      },
    ];
  },
};

export default nextConfig as NextConfig;
