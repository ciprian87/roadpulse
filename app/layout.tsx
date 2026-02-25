import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/shared/AppShell";
import { SessionProviderWrapper } from "@/components/shared/SessionProviderWrapper";
import { PWAInstallPrompt } from "@/components/shared/PWAInstallPrompt";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RoadPulse",
    template: "%s | RoadPulse",
  },
  description:
    "Real-time road closures, weather alerts, chain laws, and hazards along your route. Built for commercial truck drivers and dispatchers.",
  openGraph: {
    title: "RoadPulse — Hazards for Commercial Truck Drivers",
    description:
      "Check road closures, weather alerts, chain laws, and hazards along your route from all 50 US state 511 systems and the National Weather Service.",
    type: "website",
    siteName: "RoadPulse",
  },
  twitter: {
    card: "summary",
  },
  manifest: "/manifest.json",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="theme-color" content="#0c0f14" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="antialiased">
        <SessionProviderWrapper>
          <AppShell>{children}</AppShell>
          <PWAInstallPrompt />
        </SessionProviderWrapper>
      </body>
    </html>
  );
}
