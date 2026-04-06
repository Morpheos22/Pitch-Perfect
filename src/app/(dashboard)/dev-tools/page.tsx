"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Monitor,
  UserCheck,
  ArrowRight,
  AlertTriangle,
  Shield,
  Presentation,
  MessageSquare,
  Video,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";

const DEV_MODE_CHECK = process.env.NODE_ENV === "development";

const ADMIN_EMAIL = "helloautomagikal@gmail.com";

const moduleLinks = [
  { label: "E1 — Pitch Deck Analyser", href: "/pitch-deck-analyser/new", icon: Presentation },
  { label: "E2 — Script Check", href: "/elevator-script/new", icon: MessageSquare },
  { label: "E3 — Elevator Pitch Live", href: "/elevator-pitch-live/new", icon: Video },
  { label: "E4 — Full Pitch Session", href: "/pricing", icon: TrendingUp },
  { label: "E5 — Founder Tools", href: "/founder", icon: UserCheck },
];

type Mode = "dev" | "client" | "unknown" | "loading";

export default function DevToolsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [switching, setSwitching] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const isAdmin = isLoaded && email === ADMIN_EMAIL;
  const isOnboardingCompleted = user?.publicMetadata?.onboardingCompleted === true;

  const currentMode: Mode = !isLoaded
    ? "loading"
    : isOnboardingCompleted
      ? "dev"
      : "client";

  const handleSwitchMode = async (targetMode: "dev" | "client") => {
    setSwitching(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/dev/set-mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, mode: targetMode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatusMessage(`Error: ${data.error || "Unknown error"}`);
        return;
      }

      setStatusMessage(`Switched to ${targetMode} mode! Redirecting...`);
      setTimeout(() => {
        router.push(data.redirect);
      }, 800);
    } catch (err: any) {
      setStatusMessage(`Network error: ${err.message}`);
    } finally {
      setSwitching(false);
    }
  };

  // ── Access denied guard ──
  if (!DEV_MODE_CHECK) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription>
              Dev Tools are only available in development mode.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoaded && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-2" />
            <CardTitle className="text-xl">Access Denied</CardTitle>
            <CardDescription>
              You must be signed in as the admin account to access Dev Tools.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isLoaded || currentMode === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6" />
          Dev Tools
        </h1>
        <p className="text-muted-foreground mt-1">
          Switch between Dev Mode and Client Mode for testing.
        </p>
      </div>

      {/* Status Banner */}
      <Card className={currentMode === "dev" ? "border-primary/40 bg-primary/5" : "border-orange-500/40 bg-orange-500/5"}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentMode === "dev" ? (
                <Monitor className="w-5 h-5 text-primary" />
              ) : (
                <UserCheck className="w-5 h-5 text-orange-500" />
              )}
              <div>
                <p className="font-medium">
                  Current Mode:{" "}
                  <span className={currentMode === "dev" ? "text-primary" : "text-orange-500"}>
                    {currentMode === "dev" ? "Dev Mode" : "Client Mode"}
                  </span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {currentMode === "dev"
                    ? "Onboarding bypassed — you have full access to all features."
                    : "Onboarding reset — you will experience the new user flow."}
                </p>
              </div>
            </div>
            <Badge variant={currentMode === "dev" ? "default" : "outline"}>
              {currentMode === "dev" ? "DEV" : "CLIENT"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* User Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">User Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p><span className="text-muted-foreground">Email:</span> {email}</p>
          <p><span className="text-muted-foreground">Name:</span> {user?.firstName} {user?.lastName}</p>
          <p><span className="text-muted-foreground">Clerk ID:</span> {user?.id}</p>
          <p>
            <span className="text-muted-foreground">Onboarding Completed:</span>{" "}
            {isOnboardingCompleted ? (
              <Badge variant="default" className="ml-1 text-xs">Yes</Badge>
            ) : (
              <Badge variant="outline" className="ml-1 text-xs">No</Badge>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Mode Switch Buttons */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={currentMode === "dev" ? "border-primary/40 ring-2 ring-primary/20" : ""}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-base">Dev Mode</CardTitle>
                <CardDescription>Bypass onboarding, full access</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full gap-2"
              disabled={switching || currentMode === "dev"}
              onClick={() => handleSwitchMode("dev")}
            >
              {currentMode === "dev" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {currentMode === "dev" ? "Active" : "Switch to Dev Mode"}
            </Button>
          </CardContent>
        </Card>

        <Card className={currentMode === "client" ? "border-orange-500/40 ring-2 ring-orange-500/20" : ""}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500">
                <UserCheck className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-base">Client Mode</CardTitle>
                <CardDescription>Full onboarding experience</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              variant={currentMode === "client" ? "default" : "outline"}
              className="w-full gap-2"
              disabled={switching || currentMode === "client"}
              onClick={() => handleSwitchMode("client")}
            >
              {currentMode === "client" ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <ArrowRight className="w-4 h-4" />
              )}
              {currentMode === "client" ? "Active" : "Switch to Client Mode"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <Card className={statusMessage.startsWith("Error") ? "border-destructive/40" : "border-primary/40"}>
          <CardContent className="p-4">
            <p className="text-sm font-medium">{statusMessage}</p>
          </CardContent>
        </Card>
      )}

      {/* Quick Links to Modules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Links</CardTitle>
          <CardDescription>Navigate directly to each module</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {moduleLinks.map((mod) => (
              <a
                key={mod.href}
                href={mod.href}
                className="flex items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50 transition-colors"
              >
                <mod.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="font-medium">{mod.label}</span>
                <ArrowRight className="w-3 h-3 text-muted-foreground ml-auto shrink-0" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
