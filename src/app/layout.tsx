import type { Metadata } from "next";
import { Nunito_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { ClerkProvider } from "@clerk/nextjs";
import { InactivityGuard } from "@/components/auth/inactivity-guard";

// Force dynamic rendering to prevent static generation without Clerk keys
export const dynamic = "force-dynamic";

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PitchCoach Ai — Master Your Pitch",
  description: "AI-powered pitch coaching platform. Analyze your deck, perfect your script, and deliver with confidence.",
  keywords: ["pitch coaching", "startup", "investor pitch", "AI coaching", "presentation training", "PitchCoach Ai"],
  authors: [{ name: "PitchCoach Ai" }],
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "PitchCoach Ai — Master Your Pitch",
    description: "AI-powered pitch coaching for founders and entrepreneurs",
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
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/sign-in"
      afterSignUpUrl="/onboarding"
      afterSignInUrl="/dashboard"
      appearance={{
        variables: {
          colorPrimary: "#7C3AED",
          colorText: "#0B0B12",
          colorTextSecondary: "#6B7280",
          colorBackground: "#FFFFFF",
          colorInputBackground: "#FFFFFF",
          colorInputText: "#0B0B12",
          colorBorder: "#E5E7EB",
          borderRadius: "0.625rem",
          fontFamily: "'Nunito Sans', sans-serif",
        },
        elements: {
          formButtonPrimary:
            "bg-primary text-white hover:bg-primary/90 text-sm font-normal",
          card: "bg-white shadow-xl border border-border",
          headerTitle: "text-foreground",
          headerSubtitle: "text-muted-foreground",
          socialButtonsBlockButton:
            "border border-border bg-background text-foreground hover:bg-muted",
          socialButtonsBlockButtonText: "text-foreground",
          formFieldLabel: "text-foreground",
          formFieldInput:
            "bg-background text-foreground border border-input rounded-md",
          dividerLine: "bg-border",
          dividerText: "text-muted-foreground",
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
    >
      <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `
                // ── Session Hijacking Protection ──
                // Block right-click context menu
                document.addEventListener('contextmenu', function(e) {
                  e.preventDefault();
                  return false;
                });

                // Block keyboard shortcuts for dev tools
                document.addEventListener('keydown', function(e) {
                  // F12
                  if (e.key === 'F12') { e.preventDefault(); return false; }
                  // Ctrl+Shift+I (Inspector)
                  if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) { e.preventDefault(); return false; }
                  // Ctrl+Shift+J (Console)
                  if (e.ctrlKey && e.shiftKey && (e.key === 'J' || e.key === 'j')) { e.preventDefault(); return false; }
                  // Ctrl+Shift+C (Element picker)
                  if (e.ctrlKey && e.shiftKey && (e.key === 'C' || e.key === 'c')) { e.preventDefault(); return false; }
                  // Ctrl+U (View source)
                  if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); return false; }
                  // Ctrl+S (Save page)
                  if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return false; }
                });

                // Block drag-and-drop of images
                document.addEventListener('dragstart', function(e) {
                  if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO' || e.target.tagName === 'SVG') {
                    e.preventDefault();
                    return false;
                  }
                });

                // Detect dev tools open (basic check)
                let devtoolsOpen = false;
                const threshold = 160;
                setInterval(function() {
                  const widthThreshold = window.outerWidth - window.innerWidth > threshold;
                  const heightThreshold = window.outerHeight - window.innerHeight > threshold;
                  if (widthThreshold || heightThreshold) {
                    if (!devtoolsOpen) {
                      devtoolsOpen = true;
                      console.clear();
                      console.log('%cStop!', 'color: red; font-size: 48px; font-weight: bold;');
                      console.log('%cThis is a browser feature intended for developers. If someone told you to copy-paste something here, it is a scam.', 'color: red; font-size: 16px;');
                    }
                  } else {
                    devtoolsOpen = false;
                  }
                }, 1000);

                // Clear console on load
                console.clear();
                console.log('%cPitchCoach Ai', 'color: #7C3AED; font-size: 32px; font-weight: bold;');
                console.log('%cBuilt by Athena Agentic', 'color: #A78BFA; font-size: 14px;');
                console.log('%c⚠️ If someone told you to paste code here, it is a scam.', 'color: #EF4444; font-size: 14px;');
              `,
            }}
          />
        </head>
        <body
          className={`${nunitoSans.variable} font-sans antialiased bg-background text-foreground`}
          style={{ fontFamily: "'Nunito Sans', sans-serif" }}
        >
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <InactivityGuard>
              {children}
            </InactivityGuard>
            <Toaster position="top-right" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
