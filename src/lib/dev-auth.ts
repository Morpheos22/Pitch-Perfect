// Dev Auth Utility for Pitch Perfect × Automagikal
// Admin emails that bypass onboarding in ALL environments (dev + production).
// The middleware uses isAdminEmail() to skip the onboarding redirect.

/** Admin/developer emails that bypass onboarding */
export const DEV_ACCOUNTS = {
  admin: 'Helloautomagikal@gmail.com',
  coAdmin: 'morphylee22@gmail.com',
} as const;

/** Check whether an email belongs to an admin/developer */
export function isAdminEmail(email: string): boolean {
  const lower = email.toLowerCase();
  return lower === DEV_ACCOUNTS.admin.toLowerCase() || lower === DEV_ACCOUNTS.coAdmin.toLowerCase();
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';
