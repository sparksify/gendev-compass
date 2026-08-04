import type { Metadata, Viewport } from "next";
import { brand } from "@/lib/config/brand";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.productName} — ${brand.portalLabel}`,
  description: "Private investor qualification portal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
