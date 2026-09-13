// Dev Auth Utility for PitchCoach Ai × Athena Agentic
// Admin emails that bypass onboarding and get ENTERPRISE entitlement.
// The middleware uses isAdminEmail() to skip the onboarding redirect.
//
// SECURITY: Developer emails are read from the DEVELOPER_EMAILS env var.
// In production AND development, the env var is REQUIRED — no hardcoded fallback.
// This prevents accidental admin access from hardcoded emails leaked in source code.

/** Parsed set of developer/admin emails from DEVELOPER_EMAILS env var */
let _devEmails: Set<string> | null = null;

function getDevEmails(): Set<string> {
  if (_devEmails !== null) return _devEmails;

  const raw = process.env.DEVELOPER_EMAILS;
  if (!raw || !raw.trim()) {
    // No fallback — require the env var in ALL environments.
    // Hardcoded dev emails are a security risk (source code leak = admin access).
    console.warn('[dev-auth] DEVELOPER_EMAILS env var not set. No admin emails configured.');
    _devEmails = new Set();
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
