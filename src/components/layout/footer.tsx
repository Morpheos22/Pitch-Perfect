"use client";

import Image from "next/image";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Logo } from "./logo";

const footerLinks = {
  product: [
    { label: "Pitch Deck Analyser", href: "/pitch-deck-analyser", pricingHref: "/pricing#pitch-deck" },
    { label: "Script Check", href: "/elevator-script", pricingHref: "/pricing#elevator-script" },
    { label: "Live Pitch", href: "/elevator-pitch-live", pricingHref: "/pricing#elevator-live" },
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

        {/* Bottom bar — Metabuilder branding block */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start gap-3">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Pitch Perfect. All rights reserved.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                  Developed By
                </span>
                <span className="text-sm font-bold">
                  <a
                    href="https://www.linkedin.com/in/david-akanimoh/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-secondary hover:underline transition-colors"
                    title="Akanimoh David on LinkedIn"
                  >
                    Akanimoh David
                  </a>
                  <span className="text-muted-foreground mx-2">&middot;</span>
                  <a
                    href="https://metabuildersolutions.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-foreground hover:text-primary hover:underline transition-colors"
                    title="Metabuilder Solutions Limited"
                  >
                    Metabuilder Solutions Limited
                  </a>
                </span>
              </div>
              <a
                href="mailto:Morpheos@cc.cc"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Morpheos@cc.cc
              </a>
            </div>

            <a
              href="https://metabuildersolutions.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              title="Metabuilder Solutions Limited"
            >
              <Image
                src="/metabuilder-logo.png"
                alt="Metabuilder Solutions Limited"
                width={140}
                height={62}
                className="h-10 w-auto"
                draggable={false}
                priority
              />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
