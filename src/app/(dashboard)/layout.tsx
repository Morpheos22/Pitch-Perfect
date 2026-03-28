// Server component layout to force dynamic rendering
// This prevents static generation which requires Clerk keys at build time
export const dynamic = "force-dynamic";

import DashboardLayout from "./DashboardLayout";

export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardLayout>{children}</DashboardLayout>;
}
