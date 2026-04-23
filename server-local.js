// server-local.js — Crash-resistant local production server
//
// Prevents Next.js unhandled rejections (NEXT_HTTP_ERROR_FALLBACK from Clerk
// auth redirects) from crashing the process. These are benign rejections that
// occur when Clerk redirects unauthenticated users to sign-in pages.
//
// Usage:
//   export $(grep -v '^#' .env.local | grep -v '^$' | xargs)
//   NEXT_UNHANDLED_REJECTION_FILTER=silent node server-local.js
//
// Or via npm:
//   npm run start:local

// Suppress benign unhandled rejections BEFORE loading Next.js
process.on('unhandledRejection', (reason) => {
  if (reason?.digest?.startsWith?.('NEXT_HTTP_ERROR_FALLBACK')) {
    return; // Clerk auth redirect — safe to suppress
  }
  console.warn('[server-local] Unhandled rejection:', reason?.digest || reason?.message || String(reason).slice(0, 200));
});

// Load the standalone production server
require('./.next/standalone/server.js');
