// Dev Auth Utility for Pitch Perfect × Automagikal
// Admin emails that bypass onboarding in development only.
// The middleware uses isAdminEmail() to skip the onboarding redirect.
//
// SECURITY: Admin bypass is ONLY available in development mode (NODE_ENV=development).
// The ALLOW_ADMIN_BYPASS environment variable has been removed to prevent
// accidental production exposure of admin capabilities.

/** Admin/developer emails that bypass onboarding */
export const DEV_ACCOUNTS = {
  admin: 'Helloautomagikal@gmail.com',
  coAdmin: 'morphylee22@gmail.com',
} as const;

/** Check whether an email belongs to an admin/developer.
 *  Returns true ONLY in development mode. Production is never bypassed.
 */
export function isAdminEmail(email: string): boolean {
  // Removed: process.env.ALLOW_ADMIN_BYPASS === 'true'
  // This was a security risk — env vars can leak via /api endpoints or logs.
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }

  const lower = email.toLowerCase();
  return lower === DEV_ACCOUNTS.admin.toLowerCase() || lower === DEV_ACCOUNTS.coAdmin.toLowerCase();
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';
