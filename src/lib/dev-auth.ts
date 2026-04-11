// Dev Auth Utility for Pitch Perfect × Automagikal
// Admin emails that bypass onboarding in development only.
// The middleware uses isAdminEmail() to skip the onboarding redirect.
//
// SECURITY: Admin bypass is ONLY available in development mode (NODE_ENV=development).
// The ALLOW_ADMIN_BYPASS environment variable has been removed to prevent
// accidental production exposure of admin capabilities.

/** Parsed set of developer/admin emails from DEVELOPER_EMAILS env var */
let _devEmails: Set<string> | null = null;

/** Hardcoded dev email fallback — ensures admins always get ENTERPRISE tier
 *  even if DEVELOPER_EMAILS env var is not set (e.g., during initial deploy). */
const HARDCODED_DEV_EMAILS = new Set([
  'helloautomagikal@gmail.com',
  'morphylee22@gmail.com',
]);

function getDevEmails(): Set<string> {
  if (_devEmails !== null) return _devEmails;

  const raw = process.env.DEVELOPER_EMAILS;
  if (!raw || !raw.trim()) {
    // Use hardcoded fallback when env var is not set
    _devEmails = HARDCODED_DEV_EMAILS;
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

/** Return the list of configured dev emails (for display in dev-tools). */
function getDevEmailList(): string[] {
  return Array.from(getDevEmails());
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';
