import type { Metadata, Viewport } from "next";
import { Merriweather, Playfair_Display } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { LiveBanner } from "@/components/live-banner";
import { Toaster } from "@/components/ui/sonner";

const merriweather = Merriweather({
  variable: "--font-merriweather",
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  style: ["normal", "italic"],
});
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: "Sahaj — household help in Pokhara",
  description: "Families hire household help; helpers and verified students find paid gigs. Browse, choose and agree a price in one minute.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#6b7f5b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${merriweather.variable} ${playfair.variable} min-h-dvh antialiased`}>
        <SiteHeader />
        <LiveBanner />
        <main className="w-full px-4 pt-4 pb-16 sm:px-6 lg:px-10">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
