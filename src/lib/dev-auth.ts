// Dev Auth Utility for PitchCoach Ai × Athena Agentic
// Admin emails that bypass onboarding and get ENTERPRISE entitlement.
// The middleware uses isAdminEmail() to skip the onboarding redirect.
//
// SECURITY: Developer emails are read from the DEVELOPER_EMAILS env var.
// In production AND development, the env var is REQUIRED — no hardcoded fallback.
// This prevents accidental admin access from hardcoded emails leaked in source code.
//
// EXCEPTION: PERMANENT_FOUNDER_EMAILS below is a small, deliberate hardcoded
// list of the platform owner's own emails. These ALWAYS get ENTERPRISE/Founder
// tier regardless of env var state. This is a guarantee requested by the owner
// so a misconfigured env var can never lock them out of their own account.

/**
 * Hardcoded set of emails that ALWAYS receive Founder / ENTERPRISE tier.
 * These bypass the DEVELOPER_EMAILS env var entirely — they cannot be unset
 * without a code change + redeploy.
 *
 * Add ONLY the platform owner's verified emails here. Anyone listed has full
 * access to every feature, forever, including billing bypass.
 */
const PERMANENT_FOUNDER_EMAILS: ReadonlySet<string> = new Set(
  [
    "morphylee22@gmail.com",
    "metron@athenagentic.app",
    "azodobz@gmail.com",
  ].map((e) => e.toLowerCase().trim()),
);

/** Parsed set of developer emails from DEVELOPER_EMAILS env var */
let _devEmails: Set<string> | null = null;

function getDevEmails(): Set<string> {
  if (_devEmails !== null) return _devEmails;

  const raw = process.env.DEVELOPER_EMAILS;
  if (!raw || !raw.trim()) {
    // No fallback — require the env var in ALL environments.
    // Hardcoded dev emails are a security risk (source code leak = admin access).
    // EXCEPTION: PERMANENT_FOUNDER_EMAILS is still checked even when the env
    // var is empty — the owner's email must always work.
    console.warn('[dev-auth] DEVELOPER_EMAILS env var not set. Only PERMANENT_FOUNDER_EMAILS will be honoured.');
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
 *  Returns true if the email is in PERMANENT_FOUNDER_EMAILS (hardcoded)
 *  OR in the DEVELOPER_EMAILS env var.
 *
 *  Permanent founder emails are checked FIRST so env var misconfiguration
 *  can never demote the platform owner.
 */
export function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase().trim();
  if (PERMANENT_FOUNDER_EMAILS.has(lower)) return true;
  return getDevEmails().has(lower);
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';

/** Returns the list of permanent founder emails (for audit / display). */
export function getPermanentFounderEmails(): string[] {
  return Array.from(PERMANENT_FOUNDER_EMAILS);
}
