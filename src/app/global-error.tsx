"use client";

// global-error.tsx — catches errors thrown by the ROOT layout itself.
// This is the safety net above app/error.tsx. Without it, a layout crash
// shows a blank white screen or Vercel's default error page.
//
// Note: this component replaces <html> and <body> for the error render,
// so it must include its own document shell.

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Vercel automatically captures console.error from server components
    // when instrumentation.ts registers the error source. For client errors,
    // this is the only signal we get without a third-party logger.
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          backgroundColor: "#0B0B12",
          color: "#FFFFFF",
        }}>
          <div style={{ maxWidth: "28rem", textAlign: "center" }}>
            <div style={{
              width: "4rem", height: "4rem", margin: "0 auto 1.5rem",
              borderRadius: "9999px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.5rem",
            }}>
              ⚠️
            </div>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Application Error
            </h1>
            <p style={{ color: "#A1A1AA", marginBottom: "1rem", fontSize: "0.875rem" }}>
              The application encountered an unexpected error. Our team has been notified.
            </p>
            {error.digest && (
              <p style={{
                fontFamily: "monospace", fontSize: "0.75rem",
                color: "#71717A", marginBottom: "1.5rem",
                padding: "0.5rem", backgroundColor: "rgba(255,255,255,0.05)",
                borderRadius: "0.375rem",
              }}>
                Error ID: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              style={{
                backgroundColor: "#7C3AED", color: "white",
                padding: "0.625rem 1.5rem", borderRadius: "0.5rem",
                border: "none", cursor: "pointer",
                fontSize: "0.875rem", fontWeight: 600,
              }}
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
