"use client";

import { useEffect, useRef } from "react";
import { useClerk } from "@clerk/nextjs";

/**
 * Inactivity Logout Hook
 *
 * Signs the user out if the browser has been closed/inactive for more than
 * INACTIVITY_TIMEOUT_MS (5 minutes). Works by:
 *
 * 1. Storing a "last active" timestamp in sessionStorage on every user interaction
 * 2. On page visibility change (tab switch / browser close+reopen), checking if
 *    the stored timestamp is older than the timeout
 * 3. On page load, checking if a previous session's timestamp is stale
 *
 * Uses sessionStorage (not localStorage) so the timestamp is automatically
 * cleared when the browser session truly ends (all tabs closed). This means:
 * - Closing the browser and reopening within 5 min: session persists
 * - Closing the browser and reopening after 5 min: signed out
 * - Closing one tab but keeping another open: session persists
 * - Closing all tabs and reopening after 5 min: signed out
 */

const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const STORAGE_KEY = "pitchcoach_last_active";

function getLastActive(): number | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? parseInt(stored, 10) : null;
  } catch {
    return null;
  }
}

function setLastActive(): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — ignore
  }
}

export function useInactivityLogout() {
  const { signOut, isSignedIn } = useClerk();
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    if (!isSignedIn) return;

    // ── On mount: check if previous session timestamp is stale ──
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      const lastActive = getLastActive();
      if (lastActive !== null) {
        const elapsed = Date.now() - lastActive;
        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          // Session is stale — sign out
          console.warn("[InactivityLogout] Session stale (>5min inactive). Signing out.");
          sessionStorage.removeItem(STORAGE_KEY);
          signOut({ redirectUrl: "/sign-in" });
          return;
        }
      }
    }

    // ── Update timestamp on mount and on user activity ──
    setLastActive();

    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    let debounceTimer: ReturnType<typeof setTimeout>;

    function handleActivity() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setLastActive();
      }, 1000); // Debounce: update at most once per second
    }

    for (const event of activityEvents) {
      document.addEventListener(event, handleActivity, { passive: true });
    }

    // ── On visibility change (tab switch / browser close+reopen) ──
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        const lastActive = getLastActive();
        if (lastActive !== null) {
          const elapsed = Date.now() - lastActive;
          if (elapsed > INACTIVITY_TIMEOUT_MS) {
            console.warn("[InactivityLogout] Browser reopened after >5min. Signing out.");
            sessionStorage.removeItem(STORAGE_KEY);
            signOut({ redirectUrl: "/sign-in" });
            return;
          }
        }
        setLastActive();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ── Before unload: update timestamp one last time ──
    function handleBeforeUnload() {
      setLastActive();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      for (const event of activityEvents) {
        document.removeEventListener(event, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      clearTimeout(debounceTimer);
    };
  }, [isSignedIn, signOut]);
}
