"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CoachScriptRedirectPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace("/elevator-script/new");
  }, [router]);
  
  return null;
}
