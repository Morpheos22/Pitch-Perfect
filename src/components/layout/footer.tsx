"use client";

import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Logo } from "./logo";

const footerLinks = {
  product: [
    { label: "Pitch Deck Analyser", href: "/pitch-deck-analyser", pricingHref: "/pricing#pitch-deck" },
    { label: "Script Check", href: "/elevator-script", pricingHref: "/pricing#elevator-script" },
    { label: "Elevator Pitch Live", href: "/elevator-pitch-live", pricingHref: "/pricing#elevator-live" },
    { label: "Full Pitch Session", href: "/coach/full", pricingHref: "/pricing#pitch-live" },
    { label: "Founder Coaching", href: "/founder", pricingHref: "/pricing#master" },
  ],
  company: [
    { label: "About", href: "/about" },
    { label: "Contact", href: "/contact" },
    { label: "Blog", href: "/blog" },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Logo showText={true} size="md" />
            <p className="mt-4 text-sm text-muted-foreground max-w-xs">
              AI-powered pitch coaching for founders and entrepreneurs. Master your pitch with confidence.
            </p>
          </div>

          {/* Products — Auth-gated: signed-in users go to product, guests go to pricing */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Products</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <SignedIn>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </SignedIn>
                  <SignedOut>
                    <Link
                      href={link.pricingHref}
                      className="text-sm text-muted-foreground hover:text-primary transition-colors"
                    >
                      {link.label}
                    </Link>
                  </SignedOut>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Pitch Perfect. All rights reserved.
            </p>
            <p className="text-sm text-muted-foreground">
              Built by <a href="https://automagikal.co.za/" target="_blank" rel="noopener noreferrer" className="text-primary font-medium hover:underline">AutomagiKal</a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
