// Dev Auth Utility for Pitch Perfect × Automagikal
// Admin emails that bypass onboarding and get ENTERPRISE entitlement.
// The middleware uses isAdminEmail() to skip the onboarding redirect.
//
// SECURITY: Developer emails are read from the DEVELOPER_EMAILS env var.
// In production, the env var is REQUIRED — no hardcoded fallback.
// In development, a hardcoded fallback is allowed for convenience.

/** Parsed set of developer/admin emails from DEVELOPER_EMAILS env var */
let _devEmails: Set<string> | null = null;

/** Hardcoded dev email fallback — ONLY used in development when env var is not set */
const DEV_FALLBACK_EMAILS = new Set([
  'helloautomagikal@gmail.com',
  'morphylee22@gmail.com',
]);

function getDevEmails(): Set<string> {
  if (_devEmails !== null) return _devEmails;

  const raw = process.env.DEVELOPER_EMAILS;
  if (!raw || !raw.trim()) {
    if (process.env.NODE_ENV === 'production') {
      // In production, no hardcoded fallback — require the env var
      console.warn('[dev-auth] DEVELOPER_EMAILS env var not set in production. No admin emails configured.');
      _devEmails = new Set();
    } else {
      // In development, use fallback for convenience
      _devEmails = DEV_FALLBACK_EMAILS;
    }
    return _devEmails;
  }

  _devEmails = new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0)
  );
  return _devEmails;
}

/** Check whether an email belongs to an admin/developer.
 *  Returns true in development mode OR if the email is in the DEVELOPER_EMAILS list.
 *  Developer emails always get ENTERPRISE entitlement regardless of environment —
 *  this is intentional for testing all functionalities in production.
 */
export function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return getDevEmails().has(lower);
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';
