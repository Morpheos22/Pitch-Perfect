// src/lib/otel.ts — Lightweight OpenTelemetry registration for Vercel.
//
// This is a thin wrapper around @vercel/otel which Vercel auto-instruments
// when this package is installed. We're using a defensive dynamic import so
// the build still succeeds if @vercel/otel is not yet a dependency.
//
// What this gives us (free on Vercel):
//   - Route-level error attribution in the Vercel dashboard
//   - Function execution duration traces
//   - Outbound fetch tracing (e.g., Athena worker calls, Stripe, Clerk)
//   - Automatic capture of unhandled rejections
//
// To enable full tracing, install: npm i @vercel/otel
// Until then, this is a no-op that won't break anything.

export async function registerOTEL(opts?: { serviceName?: string }): Promise<void> {
  // Defensive: try to load @vercel/otel if available, otherwise no-op.
  // This avoids a hard dependency that would fail the build if the package
  // isn't installed yet. Using dynamic import() instead of require() to
  // comply with @typescript-eslint/no-require-imports rule.
  try {
    const mod: any = await import("@vercel/otel").catch(() => null);
    if (mod && typeof mod.registerOTEL === "function") {
      mod.registerOTEL(opts);
      console.log(`[otel] registered serviceName=${opts?.serviceName || "next-app"}`);
      return;
    }
  } catch {
    // @vercel/otel not installed — fall through to no-op.
  }
  // No-op: instrumentation hook ran but no OTEL backend configured.
  // To enable, run: npm i @vercel/otel
  console.log("[otel] @vercel/otel not installed — instrumentation is a no-op");
}
