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
  title: "Pitch Perfect - Master Your Pitch",
  description: "AI-powered pitch coaching platform. Analyze your deck, perfect your script, and deliver with confidence.",
  keywords: ["pitch coaching", "startup", "investor pitch", "AI coaching", "presentation training"],
  authors: [{ name: "Pitch Perfect" }],
  icons: {
    icon: "/favicon.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Pitch Perfect - Master Your Pitch",
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
      afterSignUpUrl="/onboarding"
      afterSignOutUrl="/sign-in"
    >
      <html lang="en" suppressHydrationWarning>
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
