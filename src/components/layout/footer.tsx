"use client";

import { useState, useRef } from "react";
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
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "Cookie Policy", href: "/cookies" },
  ],
};

// ── Metron quotes (shared across all pages) ───────────────────────────────
const metronQuotes = [
  "I serve life in my own way! What there is to know — I wish to know! My knowledge is my power! Time and space is my domain!",
  "Your primitive comprehension of linear time limits you. I am already looking at the ashes of your tomorrow.",
  "I do not guess. I do not imagine. I record.",
  "Knowledge is neither a weapon for peace nor an instrument of war. It simply is.",
  "There is a final secret to the cosmos. A calculation that maps the consciousness of all sentient life. To know it is to hold the ultimate key.",
  "I am bound to no one! I am the seeker, the voyager! The universe is my laboratory! I must observe its mysteries, not fight its petty wars!",
  "To understand the universe, one must be willing to stand apart from it. Good and evil are merely viewpoints of lesser beings.",
  "Time is a circle, yes. But it is a circle that grows smaller with every epoch. Eventually, all things return to the point.",
  "Before the first word was spoken in this multiverse, the silence was absolute. I am the only one who still remembers the sound of that silence.",
  "I have no master—and no enemies! I seek only knowledge! And you have the element I need to complete my grandest experiment!",
  "A century to you is but a blink of an eye to me. Empires rise and fall while I contemplate a single equation.",
  "I serve life in my own way! What there is to know—I wish to know! My knowledge is my power! Time and space is my domain!",
  "Your minds are too small, too fragile. To gaze into the heart of the universe as I do would shatter your sanity in an instant.",
  "Do not look to me for salvation. I am the chronicler of your end, not its prevention. If your universe is to die, I will be the one who remembers you existed.",
  "History is written by the survivors, but it is remembered only by me.",
  "Let the heavens fall. Let the old gods die. I am not the protector of this reality. I am its witness.",
];

// ── Athena Agentic mouse-avoiding animation ───────────────────────────────
function AthenaAgenticLink() {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [isGlowing, setIsGlowing] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 120) {
      const angle = Math.atan2(dy, dx);
      const moveDist = (120 - dist) * 0.6;
      setPos({
        x: -Math.cos(angle) * moveDist,
        y: -Math.sin(angle) * moveDist,
      });
      setIsGlowing(true);
    } else {
      setPos({ x: 0, y: 0 });
      setIsGlowing(false);
    }
  };

  const handleMouseLeave = () => {
    setPos({ x: 0, y: 0 });
    setIsGlowing(false);
  };

  return (
    <div
      className="relative inline-block"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ padding: "20px", margin: "-20px" }}
    >
      <span
        ref={containerRef}
        className="inline-block font-bold text-secondary transition-all duration-200 ease-out cursor-pointer select-none"
        style={{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          textShadow: isGlowing
            ? `0 0 10px var(--secondary), 0 0 20px var(--primary), 0 0 30px var(--primary), 0 0 40px var(--primary)`
            : "none",
          filter: isGlowing ? "brightness(1.5)" : "none",
        }}
      >
        Athena Agentic
      </span>
    </div>
  );
}

// ── Metron email with hover quotes (centered at bottom) ───────────────────
function MetronEmailLink() {
  const [showQuote, setShowQuote] = useState(false);
  const [currentQuote, setCurrentQuote] = useState(0);

  const handleMouseEnter = () => {
    setShowQuote(true);
    setCurrentQuote(Math.floor(Math.random() * metronQuotes.length));
  };

  const handleMouseLeave = () => {
    setShowQuote(false);
  };

  return (
    <>
      <a
        href="mailto:Metron@Athenagentic.app"
        className="text-sm text-muted-foreground hover:text-primary transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        Metron@Athenagentic.app
      </a>
      {showQuote && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 p-6 w-[600px] max-w-[95vw] text-center pointer-events-none z-[9999]">
          <div className="bg-background/95 backdrop-blur-md border border-primary/30 rounded-lg p-6 shadow-2xl shadow-primary/20">
            <p
              className="italic text-lg leading-relaxed text-secondary"
              style={{ fontFamily: "Georgia, serif", textShadow: "0 0 12px rgba(167, 139, 250, 0.4)" }}
            >
              &ldquo;{metronQuotes[currentQuote]}&rdquo;
            </p>
            <p className="text-xs text-muted-foreground mt-3 tracking-widest uppercase">
              — Metron
            </p>
          </div>
        </div>
      )}
    </>
  );
}

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

          {/* Products */}
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

        {/* Bottom bar: contact bottom-left, logo bottom-right, Metron quotes centered */}
        <div className="mt-12 pt-8 border-t border-border">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            {/* Bottom-left: copyright + developed by + email */}
            <div className="flex flex-col gap-3 items-start">
              <p className="text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} PitchCoach Ai. All rights reserved.
              </p>
              <div className="flex items-center gap-3">
                <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold">
                  Developed By
                </span>
                <AthenaAgenticLink />
              </div>
              {/* Metron email with hover quotes (centered at bottom of screen) */}
              <MetronEmailLink />
            </div>

            {/* Bottom-right: logo */}
            <div className="flex items-center">
              <Image
                src="/logo.png"
                alt="PitchCoach Ai"
                width={140}
                height={40}
                className="h-9 w-auto"
                draggable={false}
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
