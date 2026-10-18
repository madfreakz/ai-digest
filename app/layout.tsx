import type { Metadata, Viewport } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { Analytics } from '@vercel/analytics/next';
import "./globals.css";

// Self-hosted and preloaded by next/font: no render-blocking stylesheet and no
// layout shift when the web fonts arrive. Playfair for headlines, DM Sans for
// everything else.
const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
  display: "swap",
});
const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-body",
  display: "swap",
});

const DESCRIPTION = "Daily intelligence on Physical AI, AI Infrastructure, AI Labs, and Vertical AI, with BD signal";

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
