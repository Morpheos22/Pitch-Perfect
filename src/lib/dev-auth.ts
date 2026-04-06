// Dev Auth Utility for Pitch Perfect × Automagikal
// Provides development-mode login helpers for testing admin and client experiences.
// This file has NO effect in production (NODE_ENV !== 'development').

/** Admin/developer emails that bypass certain restrictions in development mode */
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
