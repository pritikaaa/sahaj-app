import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { LiveBanner } from "@/components/live-banner";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sahaj — household help in Pokhara",
  description: "Families hire household help; helpers and verified students find paid gigs. Browse, choose and agree a price in one minute.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#2a7f86" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-dvh antialiased`}>
        <SiteHeader />
        <LiveBanner />
        <main className="mx-auto w-full max-w-5xl px-4 pt-4 pb-16">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
