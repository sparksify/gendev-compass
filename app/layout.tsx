import type { Metadata, Viewport } from "next";
import { brand } from "@/lib/config/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: `${brand.brandName} — ${brand.portalLabel}`,
  description: "Private investor qualification portal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const primaryColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR;
  const accentColor = process.env.NEXT_PUBLIC_ACCENT_COLOR;
  const styleVars = [
    primaryColor ? `--brand-primary: ${sanitizeColor(primaryColor)};` : "",
    accentColor ? `--brand-accent: ${sanitizeColor(accentColor)};` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="en">
      {styleVars ? <style>{`:root { ${styleVars} }`}</style> : null}
      <body className="min-h-screen">{children}</body>
    </html>
  );
}

function sanitizeColor(value: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(value) ? value : "#0f2a43";
}
