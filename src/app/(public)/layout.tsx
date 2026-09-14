"use client";

import { AthenaWidget } from "@/components/athena/athena-widget";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <AthenaWidget />
    </>
  );
}
