// Dev Auth Utility for Pitch Perfect × Automagikal
// Provides development-mode login helpers for testing admin and client experiences.
// This file has NO effect in production (NODE_ENV !== 'development').

/** Admin/developer email that bypasses certain restrictions in development mode */
export const DEV_ACCOUNTS = {
  admin: 'Helloautomagikal@gmail.com',
} as const;

/** Check whether an email belongs to an admin/developer */
export function isAdminEmail(email: string): boolean {
  return email.toLowerCase() === DEV_ACCOUNTS.admin.toLowerCase();
}

/** True when running in Next.js development mode (npm run dev) */
export const DEV_MODE = process.env.NODE_ENV === 'development';
