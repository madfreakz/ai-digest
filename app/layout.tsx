import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

// Self-hosted and preloaded by next/font/local (OFL): zero external Google
// Fonts fetch at build time, eliminating Turbopack next/font/google flakiness.
const display = localFont({
  src: "./fonts/playfair-display-latin.woff2",
  weight: "500 600",
  variable: "--font-display",
  display: "swap",
});
const body = localFont({
  src: [
    { path: "./fonts/dm-sans-latin.woff2", weight: "400 600", style: "normal" },
    { path: "./fonts/dm-sans-latin-italic.woff2", weight: "400 600", style: "italic" },
  ],
  variable: "--font-body",
  display: "swap",
});

const DESCRIPTION = "Daily intelligence on where value shifts across Physical AI, AI Infrastructure, AI Labs, and Vertical AI";

export const metadata: Metadata = {
  metadataBase: new URL("https://frontier-ai-digest.vercel.app"),
  title: "Frontier AI Digest",
  description: DESCRIPTION,
  openGraph: {
    title: "Frontier AI Digest",
    description: DESCRIPTION,
    url: "/",
    siteName: "Frontier AI Digest",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Frontier AI Digest",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FAF8F4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
