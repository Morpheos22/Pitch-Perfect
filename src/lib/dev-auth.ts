// Dev Auth Utility for Pitch Perfect × Automagikal
// Admin emails that bypass onboarding in development only.
// The middleware uses isAdminEmail() to skip the onboarding redirect.
//
// SECURITY: This is disabled in production by default. To re-enable in production,
// set the environment variable ALLOW_ADMIN_BYPASS=true.

/** Admin/developer emails that bypass onboarding */
export const DEV_ACCOUNTS = {
  admin: 'Helloautomagikal@gmail.com',
  coAdmin: 'morphylee22@gmail.com',
} as const;

/** Check whether an email belongs to an admin/developer.
 *  Returns true only in non-production environments, OR when
 *  the ALLOW_ADMIN_BYPASS=true environment variable is explicitly set.
 */
export function isAdminEmail(email: string): boolean {
  const isAllowed = process.env.NODE_ENV !== 'production' || process.env.ALLOW_ADMIN_BYPASS === 'true';
  if (!isAllowed) return false;

  const lower = email.toLowerCase();
  return lower === DEV_ACCOUNTS.admin.toLowerCase() || lower === DEV_ACCOUNTS.coAdmin.toLowerCase();
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';
