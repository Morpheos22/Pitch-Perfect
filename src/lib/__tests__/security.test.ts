/**
 * Unit tests for src/lib/security.ts
 *
 * These tests PROVE the security library's core logic works without needing
 * a real sign-in attempt or a South African IP. They run against the actual
 * code that runs in production middleware.
 *
 * Run with: npx vitest run src/lib/__tests__/security.test.ts
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// security.ts uses crypto.subtle (Web Crypto API). jsdom may not have it
// in older vitest setups — we polyfill it via Node's crypto module.
import { webcrypto } from "crypto";
if (typeof globalThis.crypto === "undefined" || !globalThis.crypto.subtle) {
  // Cast through unknown because Node's webcrypto types slightly differ
  // from the DOM Crypto types (KeyUsage enum mismatch) — runtime is identical.
  (globalThis as unknown as { crypto: unknown }).crypto =
    webcrypto as unknown;
}

import {
  isEmailBlocked,
  getBlockedEmails,
  getBlockedEmailDomains,
  isCountryBlocked,
  isBotUserAgent,
  isProtectedAsset,
  isIpCachedBlocked,
  cacheIpBlock,
  isDeviceCachedBlocked,
  cacheDeviceBlock,
  isBlocked,
  SECURITY_HEADERS,
  PROTECTED_ASSETS,
} from "../security";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Request helper
// ─────────────────────────────────────────────────────────────────────────────
function mockRequest(headers: Record<string, string> = {}): Request {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as unknown as Request;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL BLOCKLIST TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe("Email blocklist", () => {
  it("blocks sherwynsingh888@gmail.com (exact match)", () => {
    expect(isEmailBlocked("sherwynsingh888@gmail.com")).toBe(true);
  });

  it("blocks Sherwyn@automagikal.co.za (exact match)", () => {
    expect(isEmailBlocked("Sherwyn@automagikal.co.za")).toBe(true);
  });

  it("is case-insensitive — SHERWYNSINGH888@GMAIL.COM is blocked", () => {
    expect(isEmailBlocked("SHERWYNSINGH888@GMAIL.COM")).toBe(true);
  });

  it("is case-insensitive — SHERWYN@AUTOMAGIKAL.CO.ZA is blocked", () => {
    expect(isEmailBlocked("SHERWYN@AUTOMAGIKAL.CO.ZA")).toBe(true);
  });

  it("trims whitespace — '  sherwynsingh888@gmail.com  ' is blocked", () => {
    expect(isEmailBlocked("  sherwynsingh888@gmail.com  ")).toBe(true);
  });

  it("does NOT block unlisted emails", () => {
    expect(isEmailBlocked("user@example.com")).toBe(false);
    expect(isEmailBlocked("hello@pitchcoachai.tech")).toBe(false);
    expect(isEmailBlocked("morpheos@cc.cc")).toBe(false);
  });

  it("does NOT block empty/null/undefined", () => {
    expect(isEmailBlocked("")).toBe(false);
    expect(isEmailBlocked(null)).toBe(false);
    expect(isEmailBlocked(undefined)).toBe(false);
  });

  it("does NOT block emails that look similar but are different", () => {
    // Subtle variations — must NOT trigger
    expect(isEmailBlocked("sherwynsingh888@example.com")).toBe(false);
    expect(isEmailBlocked("sherwynsingh8888@gmail.com")).toBe(false); // extra digit
    // NOTE: sherwyn@automagikal.com is NOW blocked (TLD typosquat defense)
    // — see "Blocked email domains" describe block below
  });

  it("getBlockedEmails() returns the full list", () => {
    const blocked = getBlockedEmails();
    expect(blocked).toHaveLength(2);
    expect(blocked).toContain("sherwynsingh888@gmail.com");
    expect(blocked).toContain("sherwyn@automagikal.co.za");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BLOCKED EMAIL DOMAIN TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe("Blocked email domains", () => {
  it("blocks any email from @automagikal.co.za", () => {
    expect(isEmailBlocked("admin@automagikal.co.za")).toBe(true);
    expect(isEmailBlocked("support@automagikal.co.za")).toBe(true);
    expect(isEmailBlocked("hello@automagikal.co.za")).toBe(true);
    expect(isEmailBlocked("anything@automagikal.co.za")).toBe(true);
    expect(isEmailBlocked("test.user@automagikal.co.za")).toBe(true);
  });

  it("blocks any email from @automagikal.com (TLD typosquat defense)", () => {
    expect(isEmailBlocked("admin@automagikal.com")).toBe(true);
    expect(isEmailBlocked("anything@automagikal.com")).toBe(true);
  });

  it("still blocks the specific blocked email addresses", () => {
    expect(isEmailBlocked("sherwyn@automagikal.co.za")).toBe(true);
    expect(isEmailBlocked("sherwynsingh888@gmail.com")).toBe(true);
  });

  it("does NOT block emails from unlisted domains", () => {
    expect(isEmailBlocked("user@example.com")).toBe(false);
    expect(isEmailBlocked("hello@pitchcoachai.tech")).toBe(false);
    expect(isEmailBlocked("user@gmail.com")).toBe(false); // gmail.com not blocked, only specific address
    expect(isEmailBlocked("admin@automagikal.org")).toBe(false); // .org not blocked
    expect(isEmailBlocked("admin@automagikal.io")).toBe(false); // .io not blocked
  });

  it("is case-insensitive for domain matching", () => {
    expect(isEmailBlocked("ADMIN@AUTOMAGIKAL.CO.ZA")).toBe(true);
    expect(isEmailBlocked("Sherwyn@Automagikal.Co.Za")).toBe(true);
  });

  it("trims whitespace before domain check", () => {
    expect(isEmailBlocked("  admin@automagikal.co.za  ")).toBe(true);
  });

  it("does NOT match substring domains (security check)", () => {
    // 'evilautomagikal.co.za' should NOT match 'automagikal.co.za'
    expect(isEmailBlocked("admin@evilautomagikal.co.za")).toBe(false);
    // 'automagikal.co.za.evil.com' should NOT match
    expect(isEmailBlocked("admin@automagikal.co.za.evil.com")).toBe(false);
  });

  it("handles malformed emails gracefully", () => {
    // No @ at all — return false (not blocked)
    expect(isEmailBlocked("notanemail")).toBe(false);
    // Trailing @ with no domain — return false (not blocked)
    expect(isEmailBlocked("admin@")).toBe(false); // no domain
    // NOTE: emails with a valid domain (even if malformed local part)
    // ARE blocked, because we extract the domain from after the LAST @.
    // This is correct behavior — even malformed emails from a blocked
    // domain are blocked. Clerk's own email validation will reject these
    // before they reach our middleware anyway.
    expect(isEmailBlocked("@automagikal.co.za")).toBe(true); // empty local but domain matches
    expect(isEmailBlocked("admin@@automagikal.co.za")).toBe(true); // double @ but domain matches
  });

  it("getBlockedEmailDomains() returns the configured domains", () => {
    const domains = getBlockedEmailDomains();
    expect(domains).toHaveLength(2);
    expect(domains).toContain("automagikal.co.za");
    expect(domains).toContain("automagikal.com");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GEO-BLOCK TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe("Geo-block (South Africa)", () => {
  it("blocks South Africa (ZA)", () => {
    expect(isCountryBlocked("ZA")).toBe(true);
  });

  it("blocks lowercase 'za'", () => {
    expect(isCountryBlocked("za")).toBe(true);
  });

  it("does NOT block other countries", () => {
    expect(isCountryBlocked("NG")).toBe(false); // Nigeria
    expect(isCountryBlocked("US")).toBe(false); // USA
    expect(isCountryBlocked("GB")).toBe(false); // UK
    expect(isCountryBlocked("KE")).toBe(false); // Kenya
    expect(isCountryBlocked("GH")).toBe(false); // Ghana
  });

  it("does NOT block null/undefined (e.g., when geo info missing)", () => {
    expect(isCountryBlocked(null)).toBe(false);
    expect(isCountryBlocked(undefined)).toBe(false);
    expect(isCountryBlocked("")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BOT / SCRAPER DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe("Bot / scraper User-Agent detection", () => {
  it("blocks curl", () => {
    expect(isBotUserAgent("curl/8.0.1")).toBe(true);
    expect(isBotUserAgent("curl/7.68.0")).toBe(true);
  });

  it("blocks wget", () => {
    expect(isBotUserAgent("wget/1.20.3")).toBe(true);
  });

  it("blocks python-requests", () => {
    expect(isBotUserAgent("python-requests/2.31.0")).toBe(true);
  });

  it("blocks scrapy", () => {
    expect(isBotUserAgent("Scrapy/2.11.0")).toBe(true);
  });

  it("blocks httpx", () => {
    expect(isBotUserAgent("httpx/0.27.0")).toBe(true);
  });

  it("blocks axios", () => {
    expect(isBotUserAgent("axios/1.7.0")).toBe(true);
  });

  it("blocks node-fetch", () => {
    expect(isBotUserAgent("node-fetch/1.0 (+https://github.com/bitinn/node-fetch)")).toBe(true);
  });

  it("blocks Postman Runtime", () => {
    expect(isBotUserAgent("PostmanRuntime/7.36.0")).toBe(true);
  });

  it("blocks Insomnia", () => {
    expect(isBotUserAgent("insomnia/2023.5.8")).toBe(true);
  });

  it("blocks Java clients", () => {
    expect(isBotUserAgent("Java/17.0.1")).toBe(true);
  });

  it("blocks Go HTTP client", () => {
    expect(isBotUserAgent("Go-http-client/1.1")).toBe(true);
  });

  it("blocks OkHttp", () => {
    expect(isBotUserAgent("okhttp/4.12.0")).toBe(true);
  });

  it("blocks empty User-Agent", () => {
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
  });

  it("does NOT block real browsers", () => {
    expect(isBotUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")).toBe(false);
    expect(isBotUserAgent("Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36")).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROTECTED ASSET TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe("Protected asset detection", () => {
  it("marks logo.png as protected", () => {
    expect(isProtectedAsset("/logo.png")).toBe(true);
  });

  it("marks logo-full.png as protected", () => {
    expect(isProtectedAsset("/logo-full.png")).toBe(true);
  });

  it("marks favicon.png as protected", () => {
    expect(isProtectedAsset("/favicon.png")).toBe(true);
  });

  it("marks apple-touch-icon.png as protected", () => {
    expect(isProtectedAsset("/apple-touch-icon.png")).toBe(true);
  });

  it("marks logo.svg as protected", () => {
    expect(isProtectedAsset("/logo.svg")).toBe(true);
  });

  it("marks metabuilder-logo.png as protected", () => {
    expect(isProtectedAsset("/metabuilder-logo.png")).toBe(true);
  });

  it("is case-insensitive — /LOGO.PNG is protected", () => {
    expect(isProtectedAsset("/LOGO.PNG")).toBe(true);
  });

  it("does NOT mark other assets as protected", () => {
    expect(isProtectedAsset("/random-image.png")).toBe(false);
    expect(isProtectedAsset("/some/file.svg")).toBe(false);
    expect(isProtectedAsset("/api/health")).toBe(false);
    expect(isProtectedAsset("/maintenance.html")).toBe(false);
    expect(isProtectedAsset("/")).toBe(false);
  });

  it("PROTECTED_ASSETS set contains exactly the expected entries", () => {
    expect(PROTECTED_ASSETS.size).toBe(6);
    expect(Array.from(PROTECTED_ASSETS).sort()).toEqual([
      "/apple-touch-icon.png",
      "/favicon.png",
      "/logo-full.png",
      "/logo.png",
      "/logo.svg",
      "/metabuilder-logo.png",
    ]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY BLOCK CACHE TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe("In-memory IP/device block cache", () => {
  beforeEach(() => {
    // The cache is module-level, so we can't easily clear it. Instead we
    // use unique IPs per test to avoid cross-test contamination.
  });

  it("returns null for uncached IP", () => {
    expect(isIpCachedBlocked(`192.0.2.${Math.floor(Math.random() * 255)}`)).toBeNull();
  });

  it("returns null for uncached device", () => {
    expect(isDeviceCachedBlocked(`device${Date.now()}`)).toBeNull();
  });

  it("caches and recalls IP block", () => {
    const ip = `198.51.100.${Math.floor(Math.random() * 255)}`;
    const reason = "BLOCKED_EMAIL";
    cacheIpBlock(ip, reason);
    expect(isIpCachedBlocked(ip)).toBe(reason);
  });

  it("caches and recalls device block", () => {
    const deviceId = `device-${Date.now()}-${Math.random()}`;
    const reason = "BLOCKED_IP";
    cacheDeviceBlock(deviceId, reason);
    expect(isDeviceCachedBlocked(deviceId)).toBe(reason);
  });

  it("isBlocked() checks both IP and device caches (fast path)", async () => {
    const ip = `203.0.113.${Math.floor(Math.random() * 255)}`;
    const deviceId = `device-${Date.now()}-${Math.random()}`;

    // Stub global fetch so the slow-path DB call doesn't actually fire.
    // We return {blocked: false} so the slow path returns null and we
    // test only the cache behavior.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ blocked: false, reason: null }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    try {
      // Before caching — not blocked (cache miss, slow-path returns false)
      const result1 = await isBlocked(ip, deviceId);
      expect(result1).toBeNull();

      // Cache IP block — now fast-path should hit
      const reason = "BLOCKED_EMAIL";
      cacheIpBlock(ip, reason);
      const result2 = await isBlocked(ip, deviceId);
      expect(result2).toBe(reason);

      // Different IP + device — also blocked via device cache
      const newIp = `203.0.113.${Math.floor(Math.random() * 255) + 100}`;
      cacheDeviceBlock(deviceId, "BLOCKED_DEVICE");
      const result3 = await isBlocked(newIp, deviceId);
      expect(result3).not.toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS TESTS
// ─────────────────────────────────────────────────────────────────────────────
describe("Security headers", () => {
  it("includes X-Frame-Options: DENY (clickjacking prevention)", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
  });

  it("includes X-Content-Type-Options: nosniff (MIME sniffing prevention)", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("includes HSTS with 2-year max-age and preload", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("max-age=63072000");
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("includeSubDomains");
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("preload");
  });

  it("includes Cross-Origin-Opener-Policy: same-origin", () => {
    expect(SECURITY_HEADERS["Cross-Origin-Opener-Policy"]).toBe("same-origin");
  });

  it("includes Cross-Origin-Embedder-Policy: credentialless", () => {
    expect(SECURITY_HEADERS["Cross-Origin-Embedder-Policy"]).toBe("credentialless");
  });

  it("includes Cross-Origin-Resource-Policy: same-origin", () => {
    expect(SECURITY_HEADERS["Cross-Origin-Resource-Policy"]).toBe("same-origin");
  });

  it("includes X-DNS-Prefetch-Control: off", () => {
    expect(SECURITY_HEADERS["X-DNS-Prefetch-Control"]).toBe("off");
  });

  it("includes X-Robots-Tag with noimageindex", () => {
    expect(SECURITY_HEADERS["X-Robots-Tag"]).toContain("noimageindex");
    expect(SECURITY_HEADERS["X-Robots-Tag"]).toContain("noindex");
  });

  it("includes Permissions-Policy that disables camera, microphone, geolocation", () => {
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("camera=()");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("microphone=()");
    expect(SECURITY_HEADERS["Permissions-Policy"]).toContain("geolocation=()");
  });
});
