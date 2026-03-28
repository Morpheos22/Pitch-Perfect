"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoachLiveRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/elevator-pitch-live/new");
  }, [router]);
  
  return null;
}
