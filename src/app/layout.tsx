import type { Metadata } from "next";
import { Karla, Rubik } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";

// Force dynamic rendering to prevent static generation without Clerk keys
export const dynamic = "force-dynamic";

const karla = Karla({
  variable: "--font-karla",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pitch Perfect - Master Your Pitch with AI Coaching",
  description: "AI-powered pitch coaching platform by AutomagiKal. Analyze your deck, perfect your script, and deliver with confidence. Trusted by founders worldwide.",
  keywords: ["pitch coaching", "startup", "investor pitch", "AI coaching", "presentation training", "pitch deck", "elevator pitch", "AutomagiKal"],
  authors: [{ name: "AutomagiKal" }],
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Pitch Perfect - Master Your Pitch with AI Coaching",
    description: "AI-powered pitch coaching for founders and entrepreneurs by AutomagiKal",
    type: "website",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      dynamic
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      afterSignOutUrl="/"
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${karla.variable} ${rubik.variable} font-sans antialiased bg-background text-foreground`}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
