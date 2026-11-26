import type { Metadata, Viewport } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { LiveBanner } from "@/components/live-banner";
import { Toaster } from "@/components/ui/sonner";
import { SiteFooter } from "@/components/site-footer";
import { currentProfileId } from "@/lib/session";

const dmSans = DM_Sans({ variable: "--font-dm-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sahaj — household help in Pokhara",
  description: "Families hire household help; helpers and students find paid gigs. Browse, choose and agree a price in one minute.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#a94730" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // No person selected = no polling at all.
  const meId = await currentProfileId();
  return (
    <html lang="en">
      <body className={`${dmSans.variable} min-h-dvh antialiased`}>
        <SiteHeader />
        {meId && <LiveBanner key={meId} />}
        <main className="w-full px-4 pt-5 pb-16 sm:px-8 lg:px-20">{children}</main>
        <SiteFooter />
        <Toaster />
      </body>
    </html>
  );
}
