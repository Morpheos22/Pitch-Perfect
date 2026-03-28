"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoachDeckRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/pitch-deck-analyser/new");
  }, [router]);
  
  return null;
}
