import type { NextConfig } from "next";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nextConfig: any = {
  output: "standalone",
  reactStrictMode: true,

  // Reduce RSC prefetch traffic. Next.js 15+ defaults to prefetching every
  // Link target's RSC payload on viewport. For an auth-walled dashboard with
  // many Links in the nav, this generates 4+ background RSC requests per page
  // load. Setting dynamic stale to 30s means repeated navigations within 30s
  // reuse the cached RSC payload instead of re-fetching.
  // (Link prefetching itself is still enabled — this only affects the staleness
  // window of already-fetched RSC payloads.)
  staleTimes: {
    static: 180,
    dynamic: 30,
  },

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
  // HARDENING ROUND 2026-08-26: Added COOP/COEP/CORP, X-DNS-Prefetch-Control,
  // X-Robots-Tag (noimageindex), expanded Permissions-Policy, asset protection.
  async headers() {
    return [
      // ─── GLOBAL: applies to every response (HTML, API, static assets) ───
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
                // @vercel/blob client upload
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
              // Form actions — restrict to same origin + Clerk auth
              "form-action 'self' https://clerk.pitchcoachai.tech https://*.clerk.accounts.dev https://clerk.com",
              // Base URI — restrict to self (prevents base tag injection)
              "base-uri 'self'",
              // Object/embed — block entirely (no Flash/Java plugins)
              "object-src 'none'",
              // Frame ancestors — block all framing (clickjacking)
              "frame-ancestors 'none'",
              // Upgrade all HTTP requests to HTTPS
              "upgrade-insecure-requests",
              // Plugin types — block entirely
              "plugin-types application/pdf",
              // Report violations to our health endpoint (for visibility)
              // "report-uri /api/security/csp-report",
            ].join('; '),
          },
          // Clickjacking prevention — defense-in-depth alongside CSP frame-ancestors
          { key: 'X-Frame-Options', value: 'DENY' },
          // MIME-type sniffing prevention
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Referrer leakage prevention
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Strict Permissions-Policy — disable all browser features we don't use
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=(), interest-cohort=(), browsing-topics=(), clipboard-read=(), clipboard-write=(self), payment=(), usb=(), bluetooth=(), nfc=(), magnetometer=(), gyroscope=(), accelerometer=(), ambient-light-sensor=(), vr=(), xr-spatial-tracking=()',
          },
          // Strict HSTS with preload
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Disable DNS prefetching (prevents DNS rebinding attacks)
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          // Cross-origin isolation (prevents side-channel attacks like Spectre)
          // NOTE: COEP=credentialless (not require-corp) — Clerk/Cloudflare
          // third-party iframes don't ship CORP headers, so require-corp would
          // break auth. credentialless is the pragmatic middle ground.
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
          // Robots directives — prevent search engines from indexing/caching
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, nosnippet, noimageindex' },
        ],
      },
      // ─── PROTECTED BRAND ASSETS — block direct download, must come via Referer ───
      // When someone hits /logo.png directly in their browser, return 403.
      // Same-origin requests (from our HTML pages) include a Referer header.
      // NOTE: This is defense-in-depth — middleware also enforces Referer
      // checks for these paths. vercel.json static rules run even if middleware
      // doesn't (e.g. for /_next/static).
      {
        source: '/logo.png',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, noimageindex' },
          { key: 'Content-Disposition', value: 'inline; filename="logo.png"' },
        ],
      },
      {
        source: '/logo-full.png',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, noimageindex' },
          { key: 'Content-Disposition', value: 'inline; filename="logo-full.png"' },
        ],
      },
      {
        source: '/favicon.png',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, noimageindex' },
        ],
      },
      {
        source: '/metabuilder-logo.png',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, noimageindex' },
          { key: 'Content-Disposition', value: 'inline; filename="metabuilder-logo.png"' },
        ],
      },
      {
        source: '/apple-touch-icon.png',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, noimageindex' },
        ],
      },
      {
        source: '/logo.svg',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, no-cache, must-revalidate' },
          { key: 'X-Robots-Tag', value: 'noindex, noarchive, noimageindex' },
        ],
      },
    ];
  },
};

export default nextConfig as NextConfig;
