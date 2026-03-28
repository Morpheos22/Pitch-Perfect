"use client";

import Link from "next/link";
import { Logo } from "./logo";

const footerLinks = {
  product: [
    { label: "Pitch Deck Analyser", href: "/pricing#pitch-deck" },
    { label: "Elevator Script Check", href: "/pricing#elevator-script" },
    { label: "Elevator Pitch Live", href: "/pricing#elevator-live" },
    { label: "Pitch Deck Live", href: "/pricing#pitch-live" },
    { label: "Master Pitch Analyser", href: "/pricing#master" },
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
    <footer className="border-t border-[#E2E8F0] bg-[#F7FAFA]">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-1">
            <Logo showText={true} size="md" />
            <p className="mt-4 text-sm text-[#718096] max-w-xs">
              AI-powered pitch coaching for founders and entrepreneurs. Master your pitch with confidence.
            </p>
            <p className="mt-4 text-sm text-[#718096]">
              Built by{" "}
              <a 
                href="https://automagikal.co.za" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#4ECDC4] hover:text-[#3AB8B0] font-medium transition-colors"
              >
                AutomagiKal
              </a>
            </p>
          </div>

          {/* Products */}
          <div>
            <h3 className="font-semibold text-[#2D3748] mb-4 font-heading">Products</h3>
            <ul className="space-y-2">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#718096] hover:text-[#4ECDC4] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-[#2D3748] mb-4 font-heading">Company</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#718096] hover:text-[#4ECDC4] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-[#2D3748] mb-4 font-heading">Legal</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-[#718096] hover:text-[#4ECDC4] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 border-t border-[#E2E8F0]">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-[#718096]">
              © {new Date().getFullYear()} Pitch Perfect. All rights reserved.
            </p>
            <p className="text-sm text-[#718096]">
              A product of{" "}
              <span className="text-[#4ECDC4] font-medium">AutomagiKal</span>
              {" "}(Roshwyle (Pty) Ltd)
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
