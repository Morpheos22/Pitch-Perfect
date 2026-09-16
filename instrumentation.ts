// instrumentation.ts — Next.js instrumentation hook.
//
// This file is loaded ONCE per server instance (Node.js runtime) at boot.
// Use it to register observability hooks that run BEFORE any request.
//
// Vercel + Next.js 14+ support registerOTEL() for OpenTelemetry, but we're
// using the lighter-weight approach: register Vercel's built-in error source
// tracking so unhandled errors in route handlers are attributed to their
// source file in the Vercel dashboard.
//
// No DSN needed. No third-party service. Free on all Vercel plans.

export async function register() {
  // Only run on the server (not in the Edge runtime or build-time).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { registerOTEL } = await import("./src/lib/otel");
      if (registerOTEL) {
        await registerOTEL({ serviceName: "pitchcoach-ai" });
      }
    } catch (e) {
      // Don't crash the server if instrumentation fails — log and continue.
      // The console.error here goes to Vercel's function logs.
      console.error("[instrumentation] registerOTEL failed:", e);
    }
  }
}
