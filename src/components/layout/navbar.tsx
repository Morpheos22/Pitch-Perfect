"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";

const publicNavItems = [
  { label: "How it works", href: "/#how-it-works" },
  { label: "Products", href: "/#products" },
  { label: "Pricing", href: "/pricing" },
];

const privateNavItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "History", href: "/history" },
  { label: "Pricing", href: "/pricing" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const isDashboard = pathname.startsWith("/dashboard") || 
                      pathname.startsWith("/pitch-deck-analyser") ||
                      pathname.startsWith("/elevator-script") ||
                      pathname.startsWith("/elevator-pitch-live") ||
                      pathname.startsWith("/history");

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#E2E8F0] bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">
        <Logo />

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:gap-6">
          <SignedOut>
            {publicNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-[#4ECDC4]",
                  pathname === item.href ? "text-[#4ECDC4]" : "text-[#718096]"
                )}
              >
                {item.label}
              </Link>
            ))}
          </SignedOut>
          
          <SignedIn>
            {privateNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "text-sm font-medium transition-colors hover:text-[#4ECDC4]",
                  pathname === item.href ? "text-[#4ECDC4]" : "text-[#718096]"
                )}
              >
                {item.label}
              </Link>
            ))}
          </SignedIn>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          <SignedOut>
            <div className="hidden md:flex items-center gap-2">
              <Button variant="ghost" asChild className="text-[#718096] hover:text-[#2D3748]">
                <Link href="/sign-in">Log in</Link>
              </Button>
              <Button asChild className="bg-[#FF6B6B] hover:bg-[#E85555] text-white">
                <Link href="/sign-up">Get started</Link>
              </Button>
            </div>
          </SignedOut>
          
          <SignedIn>
            <UserButton afterSignOutUrl="/" appearance={{
              elements: {
                avatarBox: "h-9 w-9",
                userButtonTrigger: "focus:shadow-none",
              },
            }} />
          </SignedIn>

          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-[#718096]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[#E2E8F0] bg-white">
          <div className="container mx-auto px-4 py-4 space-y-3">
            <SignedOut>
              {publicNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block py-2 text-sm font-medium text-[#718096] hover:text-[#4ECDC4]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
              <div className="flex flex-col gap-2 pt-4 border-t border-[#E2E8F0]">
                <Button variant="ghost" asChild className="w-full justify-start text-[#718096]">
                  <Link href="/sign-in">Log in</Link>
                </Button>
                <Button asChild className="w-full bg-[#FF6B6B] hover:bg-[#E85555] text-white">
                  <Link href="/sign-up">Get started</Link>
                </Button>
              </div>
            </SignedOut>
            
            <SignedIn>
              {privateNavItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block py-2 text-sm font-medium text-[#718096] hover:text-[#4ECDC4]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </SignedIn>
          </div>
        </div>
      )}
    </header>
  );
}
