"use client";

import { useState, useEffect, useCallback } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Mail,
  Shield,
  CreditCard,
  LogOut,
  Save,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  subscription: {
    plan: string;
    status: string;
  } | null;
}

export default function SettingsPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      const res = await fetch("/api/user/sync");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success && json.user) {
        setUserData(json.user);
      }
    } catch {
      // Non-critical
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleEdit = () => {
    setFirstName(clerkUser?.firstName || "");
    setLastName(clerkUser?.lastName || "");
    setEditing(true);
    setSaveMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await clerkUser?.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
      });
      setSaveMessage({ type: "success", text: "Name updated successfully." });
      setEditing(false);
      // Refresh user data
      fetchUserData();
    } catch {
      setSaveMessage({ type: "error", text: "Failed to update name. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const email = clerkUser?.primaryEmailAddress?.emailAddress;
  const plan = userData?.subscription?.plan || "FREE";
  const planLabel = plan === "FREE" ? "Free" : plan === "STARTER" ? "Starter" : plan === "PROFESSIONAL" ? "Professional" : plan === "ENTERPRISE" ? "Enterprise" : plan;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="w-5 h-5" />
            Profile
          </CardTitle>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isLoaded || loading ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={clerkUser?.imageUrl} alt="User" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                    {clerkUser?.firstName?.[0]}{clerkUser?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-lg">
                    {clerkUser?.firstName} {clerkUser?.lastName || ""}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {email}
                  </p>
                  <Badge variant="secondary" className="mt-1 bg-accent/10 text-accent">
                    {planLabel}
                  </Badge>
                </div>
              </div>

              <Separator />

              {/* Edit Name Form */}
              {editing ? (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">First Name</label>
                      <Input
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="First name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Last Name</label>
                      <Input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button onClick={handleSave} disabled={saving} className="gap-2">
                      <Save className="w-4 h-4" />
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="outline" onClick={() => { setEditing(false); setSaveMessage(null); }}>
                      Cancel
                    </Button>
                  </div>
                  {saveMessage && (
                    <p className={`text-sm flex items-center gap-1 ${saveMessage.type === "success" ? "text-secondary" : "text-destructive"}`}>
                      {saveMessage.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {saveMessage.text}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleEdit}>
                    Edit Name
                  </Button>
                </div>
              )}

              {saveMessage && !editing && (
                <p className={`text-sm flex items-center gap-1 ${saveMessage.type === "success" ? "text-secondary" : "text-destructive"}`}>
                  {saveMessage.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  {saveMessage.text}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the look of your dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Theme</p>
              <p className="text-sm text-muted-foreground">Toggle between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Billing
          </CardTitle>
          <CardDescription>Manage your subscription and billing details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                Current Plan: <Badge variant="secondary" className="ml-1 bg-accent/10 text-accent">{planLabel}</Badge>
              </p>
              <p className="text-sm text-muted-foreground">View usage, upgrade, or manage your subscription</p>
            </div>
            <Link href="/dashboard/settings/billing">
              <Button variant="outline" className="gap-2">
                View Billing
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-lg text-destructive flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">Sign out of your account on this device</p>
            </div>
            <Button variant="destructive" className="gap-2" onClick={() => signOut()}>
              <LogOut className="w-4 h-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
