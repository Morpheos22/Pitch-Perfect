"use client";

import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
  href?: string;
}

export function Logo({ size = "md", showText = true, className = "", href = "/" }: LogoProps) {
  const sizes = {
    sm: { width: 32, height: 32, text: "text-lg" },
    md: { width: 40, height: 40, text: "text-xl" },
    lg: { width: 56, height: 56, text: "text-2xl" },
  };

  const { width, height, text } = sizes[size];

  return (
    <Link href={href} className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.png"
        alt="Pitch Perfect"
        width={width}
        height={height}
        className="rounded-lg"
        priority
      />
      {showText && (
        <span className={`font-bold ${text} text-primary`}>
          Pitch<span className="text-secondary">Perfect</span>
        </span>
      )}
    </Link>
  );
}
