// Minimal layout for onboarding — no sidebar, no PlanBadge, no /api/user/sync calls
export const dynamic = "force-dynamic";

export default function OnboardingGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      {children}
    </div>
  );
}
