"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";

// Sync Clerk user with our database
// The API uses auth() to get the user - no need to send user data
export function useUserSync() {
  const { user, isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user) return;

    // Sync user to our database - API handles everything via auth()
    const syncUser = async () => {
      try {
        const response = await fetch("/api/user/sync", {
          method: "POST",
        });

        if (!response.ok) {
          console.error("Failed to sync user:", response.status);
        }
      } catch (error) {
        console.error("Failed to sync user:", error);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, user]);

  return { user, isLoaded, isSignedIn };
}
