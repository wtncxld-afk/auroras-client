import type { Metadata, Viewport } from "next";
import "./globals.css";

// Every page reads live data (releases, settings) and carries a per-request CSP nonce, so nothing is prerendered.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "http://localhost:3000"),
  title: { default: "Auroras Client — Minecraft Java Edition launcher and client", template: "%s · Auroras Client" },
  description: "A Windows launcher and Fabric client mod for Minecraft Java Edition with animated skies, a customisable HUD, emotes, Totem Studio and clean instance management.",
  applicationName: "Auroras Client",
  openGraph: { type: "website", siteName: "Auroras Client", images: [{ url: "/brand/logo-lockup.png", width: 512, height: 512, alt: "Auroras Client" }] },
  twitter: { card: "summary", images: ["/brand/logo-lockup.png"] },
  icons: { apple: "/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#04060b", colorScheme: "dark", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-night-950">
      <body className="min-h-dvh bg-night-950 font-sans">{children}</body>
    </html>
  );
}
