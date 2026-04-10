// Dev Auth Utility for Pitch Perfect × Automagikal
// Admin emails that bypass onboarding in development only.
// The middleware uses isAdminEmail() to skip the onboarding redirect.
//
// SECURITY: Admin bypass is ONLY available in development mode (NODE_ENV=development).
// The ALLOW_ADMIN_BYPASS environment variable has been removed to prevent
// accidental production exposure of admin capabilities.

/** Parsed set of developer/admin emails from DEVELOPER_EMAILS env var */
let _devEmails: Set<string> | null = null;

function getDevEmails(): Set<string> {
  if (_devEmails !== null) return _devEmails;

  const raw = process.env.DEVELOPER_EMAILS;
  if (!raw || !raw.trim()) {
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
 *  Returns true ONLY in development mode. Production is never bypassed.
 */
export function isAdminEmail(email: string): boolean {
  // Must be in development mode
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  const lower = email.toLowerCase();
  return getDevEmails().has(lower);
}

/** Return the list of configured dev emails (for display in dev-tools).
 *  Returns empty array in production.
 */
export function getDevEmailList(): string[] {
  if (process.env.NODE_ENV !== 'development') {
    return [];
  }
  return Array.from(getDevEmails());
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';
