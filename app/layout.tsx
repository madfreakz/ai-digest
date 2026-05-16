import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Physical AI Daily",
  description: "Daily digest of Physical AI, robotics, and embodied AI news",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 antialiased">{children}</body>
    </html>
  );
}
