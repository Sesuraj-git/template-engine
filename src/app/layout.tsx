import type { Metadata } from "next";
import { Geist, Geist_Mono, Courier_Prime } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Monospaced, fixed-pitch face: mirrors the character-cell fonts thermal
// (ESC/POS) printers render natively, so the on-screen bill preview matches
// print output and item/price columns stay aligned without a real table grid.
const thermalMono = Courier_Prime({
  variable: "--font-thermal",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Invoice Template Engine",
  description: "Industrial invoice template designer for KOT, bills, and receipts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${thermalMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
