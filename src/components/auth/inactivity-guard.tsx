"use client";

import { useInactivityLogout } from "@/hooks/use-inactivity-logout";

/**
 * Global inactivity guard — wraps the entire app so the 20-minute
 * auto-logout applies to ALL authenticated pages, not just the dashboard.
 */
export function InactivityGuard({ children }: { children: React.ReactNode }) {
  useInactivityLogout();
  return <>{children}</>;
}
