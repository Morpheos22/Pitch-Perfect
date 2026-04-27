"use client";

import { useEffect, useRef, useCallback } from "react";
import { useClerk } from "@clerk/nextjs";
import { createLogger } from "@/lib/logger";

const logger = createLogger("InactivityLogout");

/**
 * Inactivity Logout Hook — 20-Minute Auto-Logout
 *
 * STANDING SECURITY INSTRUCTION:
 * Users are automatically logged out after 20 minutes of inactivity.
 * This applies to ALL authenticated pages across the platform.
 *
 * Dual-layer enforcement:
 * 1. CLIENT-SIDE (this hook): Running inactivity timer that signs out the user
 *    after 20 minutes of no mouse/keyboard/scroll/touch activity.
 *    Also checks sessionStorage timestamp on tab visibility change and page load
 *    to handle browser-close-and-reopen scenarios.
 *
 * 2. SERVER-SIDE: Clerk JWT TTL ensures tokens expire, and the
 *    /api/auth/revoke-all-sessions endpoint can force-logout all users.
 *
 * Uses sessionStorage (not localStorage) so the timestamp is automatically
 * cleared when the browser session truly ends (all tabs closed).
 */

const INACTIVITY_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes — STANDING INSTRUCTION
const STORAGE_KEY = "pitchcoach_last_active";
const WARNING_BEFORE_MS = 60_000; // Show warning 1 minute before logout

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
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSignOut = useCallback(() => {
    logger.warn("Session expired due to inactivity (>20min). Signing out.");
    sessionStorage.removeItem(STORAGE_KEY);
    signOut({ redirectUrl: "/sign-in" });
  }, [signOut]);

  const resetTimers = useCallback(() => {
    // Clear existing timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
    }

    // Set new timers
    warningTimerRef.current = setTimeout(() => {
      logger.info("Session will expire in 1 minute due to inactivity.");
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    inactivityTimerRef.current = setTimeout(() => {
      handleSignOut();
    }, INACTIVITY_TIMEOUT_MS);
  }, [handleSignOut]);

  useEffect(() => {
    if (!isSignedIn) return;

    // ── On mount: check if previous session timestamp is stale ──
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      const lastActive = getLastActive();
      if (lastActive !== null) {
        const elapsed = Date.now() - lastActive;
        if (elapsed > INACTIVITY_TIMEOUT_MS) {
          logger.warn("Session stale (>20min inactive on load). Signing out.");
          sessionStorage.removeItem(STORAGE_KEY);
          signOut({ redirectUrl: "/sign-in" });
          return;
        }
      }
    }

    // ── Update timestamp on mount and start inactivity timer ──
    setLastActive();
    resetTimers();

    // ── Track user activity — reset timer on any interaction ──
    const activityEvents = ["mousedown", "keydown", "scroll", "touchstart", "click"];
    let debounceTimer: ReturnType<typeof setTimeout>;

    function handleActivity() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setLastActive();
        resetTimers();
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
            logger.warn("Browser reopened after >20min inactivity. Signing out.");
            sessionStorage.removeItem(STORAGE_KEY);
            signOut({ redirectUrl: "/sign-in" });
            return;
          }
        }
        setLastActive();
        resetTimers();
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
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [isSignedIn, signOut, resetTimers]);
}
