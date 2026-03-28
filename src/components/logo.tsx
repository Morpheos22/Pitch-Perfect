import Image from "next/image";
import Link from "next/link";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  href?: string;
  className?: string;
}

export function Logo({ 
  size = "md", 
  showText = true, 
  href = "/",
  className = "" 
}: LogoProps) {
  const sizes = {
    sm: { width: 24, height: 24, text: "text-lg" },
    md: { width: 32, height: 32, text: "text-xl" },
    lg: { width: 40, height: 40, text: "text-2xl" },
  };

  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Logo Image */}
      <Image
        src="/logo.png"
        alt="Pitch Perfect"
        width={sizes[size].width}
        height={sizes[size].height}
        className="rounded-lg"
        priority
      />
      
      {/* Logo Text */}
      {showText && (
        <span className={`font-bold ${sizes[size].text} text-foreground`}>
          Pitch<span className="text-secondary">Perfect</span>
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
