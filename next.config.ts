import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextConfig: any = {
  output: "standalone",
  reactStrictMode: true,

  // Ensure @vercel/blob/client is properly transpiled for browser usage.
  // The client subpath uses Node.js modules (undici, crypto) that must be
  // replaced with browser-compatible versions via the package's "browser" field.
  transpilePackages: ["@vercel/blob"],

  // ── Redirects — Replacing dead page components with server-level redirects ──
  // These replace the zombie /coach/deck, /coach/script, /coach/live pages
  // that were redirect-only components. Server-level redirects are more efficient
  // (no JS bundle parsed) and eliminate the dead page files.
  async redirects() {
    return [
      {
        source: '/coach/deck',
        destination: '/pitch-deck-analyser/new',
        permanent: true,
      },
      {
        source: '/coach/script',
        destination: '/elevator-script/new',
        permanent: true,
      },
      {
        source: '/coach/live',
        destination: '/elevator-pitch-live/new',
        permanent: true,
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'public.blob.vercel-storage.com' },
      { protocol: 'https', hostname: 'workdrive.zoho.com' },
      { protocol: 'https', hostname: 'clerk.pitchcoachai.tech' },
      { protocol: 'https', hostname: 'img.clerk.com' },
    ],
  },

  serverExternalPackages: [
    "z-ai-web-dev-sdk",
    "pdf-parse",
    "mammoth",
    "jszip",
    "resend",
  ],

  // ── Body size limits for large file uploads ──
  // proxyClientMaxBodySize handles proxy/middleware body size (replaces deprecated middlewareClientMaxBodySize).
  // serverActions.bodySizeLimit is a top-level config in Next.js 16+ (no longer under experimental).
  experimental: {
    proxyClientMaxBodySize: '50mb',
    serverActions: {
      bodySizeLimit: '35mb',
    },
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
          // SECURITY NOTE: 'unsafe-eval' and 'unsafe-inline' in script-src are REQUIRED
          // by Clerk's authentication SDK. Clerk injects inline scripts for FAPI
          // communication and uses eval-like patterns for session management.
          // Without these, Clerk auth breaks entirely on the client side.
          // TODO: Investigate Clerk nonce-based CSP when available for hardening.
          // Mitigation: All other security headers are strict (HSTS, X-Frame-Options, etc.)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Script sources: Clerk auth (custom FAPI domain + standard), Cloudflare challenges, analytics
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.com https://*.clerk.accounts.dev https://cdn.clerk.com https://clerk.pitchcoachai.tech https://challenges.cloudflare.com https://static.cloudflareinsights.com",
              // Style sources: Google Fonts, Clerk
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.clerk.accounts.dev https://clerk.pitchcoachai.tech",
              // Font sources
              "font-src 'self' https://fonts.gstatic.com",
              // Image sources: blobs, data URIs, any HTTPS (for deck screenshots)
              "img-src 'self' data: https: blob:",
              // Connect sources: Clerk API, Z.ai, Vercel Blob, Google AI, Upstash, Zoho
              // SECURITY: Internal IP (172.25.x.x) only included in development.
              // Production uses ZAI_BASE_URL env var — never expose private IPs in CSP.
              // BUG FIX: The previous version omitted the "connect-src " directive prefix,
              // causing the browser to treat the values as an invalid directive and block
              // ALL cross-origin XHR/fetch — including Clerk JS FAPI calls. This was the
              // root cause of the empty <SignUp>/<SignIn> components on production.
              "connect-src " + [
                "'self'",
                process.env.NODE_ENV === 'development' && process.env.ZAI_BASE_URL?.startsWith('http://') ? process.env.ZAI_BASE_URL : '',
                'https://api.clerk.com',
                'https://*.clerk.com',
                'https://*.clerk.accounts.dev',
                'https://clerk.pitchcoachai.tech',
                'https://clerk.telemetry.cloudflare.com',
                'https://clerk.com',
                'https://z.ai',
                // @vercel/blob client upload: the SDK's upload() function sends the
                // file to https://vercel.com/api/blob (default VERCEL_BLOB_API_URL).
                // Without this in connect-src, the browser blocks the PUT request
                // due to CSP violation — this was the root cause of Script Check
                // uploads silently failing (no blob URL = no feedback to give).
                'https://vercel.com',
                'https://blob.vercel-storage.com',
                'https://*.blob.vercel-storage.com',
                'https://*.public.blob.vercel-storage.com',
                'https://*.vercel-storage.com',
                'https://generativelanguage.googleapis.com',
                'https://*.aiplatform.googleapis.com',
                'https://api.upstash.com',
                'https://*.zoho.com',
                // Cloudflare Turnstile CAPTCHA backend (Clerk uses smart widget)
                'https://challenges.cloudflare.com',
              ].filter(Boolean).join(' '),
              // Frame sources: Clerk auth iframe (custom FAPI domain + standard), Cloudflare challenge
              "frame-src 'self' https://challenges.cloudflare.com https://clerk.com https://*.clerk.accounts.dev https://clerk.pitchcoachai.tech",
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
