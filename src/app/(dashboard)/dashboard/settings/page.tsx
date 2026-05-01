"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Camera,
  Loader2,
  KeyRound,
  Eye,
  EyeOff,
  AtSign,
  Building2,
  Briefcase,
  Globe,
  ExternalLink,
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
  const [username, setUsername] = useState("");
  const [organization, setOrganization] = useState("");
  const [role, setRole] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [pwForm, setPwForm] = useState({ current: "", newPassword: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showPw, setShowPw] = useState({ current: false, newPassword: false, confirm: false });

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
    const meta = (clerkUser?.unsafeMetadata || {}) as Record<string, string>;
    setUsername((meta.username as string) || "");
    setOrganization((meta.organization as string) || "");
    setRole((meta.role as string) || "");
    setSocialUrl((meta.socialUrl as string) || "");
    setEditing(true);
    setSaveMessage(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage(null);

    // Validate username (optional, but if provided must be alphanumeric + underscores, 3-30 chars)
    const trimmedUsername = username.trim();
    if (trimmedUsername && !/^[a-zA-Z0-9_]{3,30}$/.test(trimmedUsername)) {
      setSaveMessage({ type: "error", text: "Username must be 3-30 characters: letters, numbers, and underscores only." });
      setSaving(false);
      return;
    }

    // Validate social URL (optional, but if provided must start with http:// or https://)
    const trimmedSocialUrl = socialUrl.trim();
    if (trimmedSocialUrl && !/^https?:\/\/.+/.test(trimmedSocialUrl)) {
      setSaveMessage({ type: "error", text: "Social URL must start with http:// or https://" });
      setSaving(false);
      return;
    }

    try {
      // Update firstName/lastName via Clerk's native fields
      await clerkUser?.update({
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        unsafeMetadata: {
          ...clerkUser?.unsafeMetadata,
          username: trimmedUsername || "",
          organization: organization.trim(),
          role: role.trim(),
          socialUrl: trimmedSocialUrl || "",
        },
      });

      // Sync profile data to Zoho CRM via dedicated profile API (fire-and-forget)
      fetch("/api/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim() || undefined,
          lastName: lastName.trim() || undefined,
          username: trimmedUsername || undefined,
          organization: organization.trim() || undefined,
          role: role.trim() || undefined,
          socialUrl: trimmedSocialUrl || undefined,
        }),
      }).catch(() => {
        // Non-critical — CRM sync is best-effort
      });

      setSaveMessage({ type: "success", text: "Profile updated successfully." });
      setEditing(false);
      // Refresh user data
      fetchUserData();
    } catch {
      setSaveMessage({ type: "error", text: "Failed to update profile. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setSaveMessage({ type: "error", text: "Please select an image file." });
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setSaveMessage({ type: "error", text: "Image must be smaller than 5MB." });
      return;
    }

    setAvatarUploading(true);
    setSaveMessage(null);
    try {
      await clerkUser?.setProfileImage({ file });
      setSaveMessage({ type: "success", text: "Avatar updated successfully." });
    } catch {
      setSaveMessage({ type: "error", text: "Failed to update avatar. Please try again." });
    } finally {
      setAvatarUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Password change handler
  const handlePasswordChange = async () => {
    setPwMessage(null);
    if (!pwForm.current || !pwForm.newPassword || !pwForm.confirm) {
      setPwMessage({ type: "error", text: "All password fields are required." });
      return;
    }
    if (pwForm.newPassword.length < 6) {
      setPwMessage({ type: "error", text: "New password must be at least 6 characters." });
      return;
    }
    // Validate password complexity
    const pwErrors: string[] = [];
    if (!/[A-Z]/.test(pwForm.newPassword)) pwErrors.push('an uppercase letter');
    if (!/[a-z]/.test(pwForm.newPassword)) pwErrors.push('a lowercase letter');
    if (!/[0-9]/.test(pwForm.newPassword)) pwErrors.push('a number');
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pwForm.newPassword)) pwErrors.push('a special character');
    if (pwErrors.length > 0) {
      setPwMessage({ type: "error", text: `Password must contain at least: ${pwErrors.join(', ')}.` });
      return;
    }
    if (pwForm.newPassword !== pwForm.confirm) {
      setPwMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    setPwSaving(true);
    try {
      // Use our server-side API which proxies to Clerk (avoids CORS)
      const token = await clerkUser?.getSessions()?.[0]?.getToken();
      if (!token) {
        setPwMessage({ type: "error", text: "Session expired. Please sign in again." });
        return;
      }

      const res = await fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: pwForm.current,
          newPassword: pwForm.newPassword,
        }),
      });

      if (res.ok) {
        setPwMessage({ type: "success", text: "Password changed successfully." });
        setPwForm({ current: "", newPassword: "", confirm: "" });
      } else {
        const data = await res.json().catch(() => ({}));
        setPwMessage({ type: "error", text: data.error || "Failed to change password. Verify your current password and try again." });
      }
    } catch {
      setPwMessage({ type: "error", text: "Network error. Please try again." });
    } finally {
      setPwSaving(false);
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
                <div className="relative group">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={clerkUser?.imageUrl} alt="User" />
                    <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                      {clerkUser?.firstName?.[0]}{clerkUser?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-not-allowed"
                  >
                    {avatarUploading ? (
                      <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                      <Camera className="h-5 w-5 text-white" />
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>
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

              {/* Profile Details */}
              {editing ? (
                <div className="space-y-4">
                  {/* First Name / Last Name — 2-column grid */}
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

                  {/* Username — full width */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <AtSign className="w-3.5 h-3.5 text-muted-foreground" />
                      Username
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="e.g. jane_doe"
                    />
                    <p className="text-xs text-muted-foreground">3-30 characters, letters, numbers, and underscores only.</p>
                  </div>

                  {/* Organization / Role — 2-column grid */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                        Organization / Company
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <Input
                        value={organization}
                        onChange={(e) => setOrganization(e.target.value)}
                        placeholder="e.g. Acme Inc."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 text-muted-foreground" />
                        Role / Occupation
                        <span className="text-muted-foreground font-normal">(optional)</span>
                      </label>
                      <Input
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        placeholder="e.g. CEO"
                      />
                    </div>
                  </div>

                  {/* Social URL — full width */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      Social Media / Portfolio URL
                      <span className="text-muted-foreground font-normal">(optional)</span>
                    </label>
                    <Input
                      value={socialUrl}
                      onChange={(e) => setSocialUrl(e.target.value)}
                      placeholder="https://yourportfolio.com"
                    />
                    <p className="text-xs text-muted-foreground">Must start with http:// or https://</p>
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
                <>
                  {/* Read-only profile details */}
                  <div className="space-y-3">
                    {/* Username */}
                    {(() => {
                      const meta = (clerkUser?.unsafeMetadata || {}) as Record<string, string>;
                      const displayUsername = (meta.username as string) || "";
                      const displayOrg = (meta.organization as string) || "";
                      const displayRole = (meta.role as string) || "";
                      const displaySocial = (meta.socialUrl as string) || "";
                      return (
                        <>
                          {displayUsername && (
                            <div className="flex items-center gap-2 text-sm">
                              <AtSign className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">Username:</span>
                              <span>@{displayUsername}</span>
                            </div>
                          )}
                          {displayOrg && (
                            <div className="flex items-center gap-2 text-sm">
                              <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">Organization:</span>
                              <span>{displayOrg}</span>
                            </div>
                          )}
                          {displayRole && (
                            <div className="flex items-center gap-2 text-sm">
                              <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">Role:</span>
                              <span>{displayRole}</span>
                            </div>
                          )}
                          {displaySocial && (
                            <div className="flex items-center gap-2 text-sm">
                              <Globe className="w-4 h-4 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">Social:</span>
                              <a
                                href={displaySocial}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                {displaySocial}
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                          {!displayUsername && !displayOrg && !displayRole && !displaySocial && (
                            <p className="text-sm text-muted-foreground italic">No additional profile info added yet.</p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleEdit}>
                      Edit Profile
                    </Button>
                  </div>
                </>
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

      {/* Security — Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Security
          </CardTitle>
          <CardDescription>Change your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Current Password</label>
              <div className="relative">
                <Input
                  type={showPw.current ? "text" : "password"}
                  placeholder="Enter current password"
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  disabled={pwSaving}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw({ ...showPw, current: !showPw.current })}
                >
                  {showPw.current ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">New Password</label>
              <div className="relative">
                <Input
                  type={showPw.newPassword ? "text" : "password"}
                  placeholder="Min 6 chars: uppercase, lowercase, number, special"
                  value={pwForm.newPassword}
                  onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
                  disabled={pwSaving}
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw({ ...showPw, newPassword: !showPw.newPassword })}
                >
                  {showPw.newPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Confirm New Password</label>
              <div className="relative">
                <Input
                  type={showPw.confirm ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={pwForm.confirm}
                  onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                  disabled={pwSaving}
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPw({ ...showPw, confirm: !showPw.confirm })}
                >
                  {showPw.confirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          {pwMessage && (
            <p className={`text-sm flex items-center gap-1 ${pwMessage.type === "success" ? "text-secondary" : "text-destructive"}`}>
              {pwMessage.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              {pwMessage.text}
            </p>
          )}
          <Button onClick={handlePasswordChange} disabled={pwSaving} className="gap-2">
            {pwSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {pwSaving ? "Changing..." : "Change Password"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Password requirements: minimum 6 characters with at least one uppercase letter, one lowercase letter, one number, and one special character (!@#$%^&* etc.).
          </p>
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
