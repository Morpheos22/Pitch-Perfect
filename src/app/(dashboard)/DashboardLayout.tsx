"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { AthenaWidget } from "@/components/athena/athena-widget";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Presentation,
  MessageSquare,
  Video,
  Settings,
  LogOut,
  User,
  CreditCard,
  Menu,
  History,
  Shield,
  Rocket,
} from "lucide-react";
import { useState, useEffect } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useClerk, useUser } from "@clerk/nextjs";
import { formatPlanName } from "@/lib/plan-config";

const IS_DEV = process.env.NODE_ENV === "development";

interface PlanBadgeProps {
  className?: string;
}

// Simple session-level cache for plan data to avoid re-fetching /api/user/sync
// on every navigation within the dashboard
let _planCache: { plan: string; ts: number } | null = null;
const PLAN_CACHE_TTL = 30_000; // 30 seconds

function PlanBadge({ className }: PlanBadgeProps) {
  const [plan, setPlan] = useState<string | null>(() => {
    // Initialize from cache if available and fresh
    if (_planCache && Date.now() - _planCache.ts < PLAN_CACHE_TTL) {
      return _planCache.plan;
    }
    return null;
  });

  useEffect(() => {
    async function fetchPlan() {
      // Skip fetch if we already have a fresh cached plan
      if (_planCache && Date.now() - _planCache.ts < PLAN_CACHE_TTL) {
        return; // plan already set via useState initializer
      }

      try {
        const res = await fetch("/api/user/sync");
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.user?.subscription?.plan) {
            const planName = formatPlanName(json.user.subscription.plan);
            _planCache = { plan: planName, ts: Date.now() };
            setPlan(planName);
          } else {
            _planCache = { plan: "Free", ts: Date.now() };
            setPlan("Free");
          }
        }
      } catch {
        setPlan(null);
      }
    }
    fetchPlan();
  }, []);

  if (!plan) return null;

  return (
    <Badge variant="secondary" className={`hidden sm:flex bg-accent/10 text-accent ${className ?? ""}`}>
      {plan}
    </Badge>
  );
}

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Pitch Deck Analyser", href: "/pitch-deck-analyser", icon: Presentation },
  { name: "Script Check", href: "/elevator-script", icon: MessageSquare },
  { name: "Elevator Live", href: "/elevator-pitch-live", icon: Video },
  { name: "Full Pitch Session", href: "/coach/full", icon: LayoutDashboard },
  { name: "Founder Coaching", href: "/founder", icon: Rocket },
  { name: "History", href: "/history", icon: History },
];

interface SidebarContentProps {
  onNavigate?: () => void;
  pathname: string;
}

function SidebarContent({ onNavigate, pathname }: SidebarContentProps) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Logo size="md" href="/dashboard" />
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="border-t p-4 space-y-1">
        <Link
          href="/pricing"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <CreditCard className="h-4 w-4" />
          Upgrade Plan
        </Link>
        <Link
          href="/dashboard/settings"
          onClick={onNavigate}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        {IS_DEV && (
          <Link
            href="/dev-tools"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-orange-500 hover:bg-orange-500/10 hover:text-orange-600 transition-colors"
          >
            <Shield className="h-4 w-4" />
            Dev Tools
          </Link>
        )}
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent pathname={pathname} onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-50 hidden w-64 border-r bg-background lg:block">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Main Content */}
      <div className="lg:pl-64">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 lg:px-6">
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <PlanBadge />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user?.imageUrl} alt="User" />
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {user?.firstName?.[0]}{user?.lastName?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.firstName} {user?.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground font-mono">
                      ID: {user?.id?.slice(0, 12)}...
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings/billing" className="flex items-center">
                    <CreditCard className="mr-2 h-4 w-4" />
                    Billing
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/settings" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/history" className="flex items-center">
                    <History className="mr-2 h-4 w-4" />
                    History
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => signOut()}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>

      {/* Athena AI Guide Widget */}
      <AthenaWidget />
    </div>
  );
}
