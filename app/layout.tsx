import type { Metadata, Viewport } from "next";
import { Inter, Manrope, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--ff-inter", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--ff-manrope", display: "swap", weight: ["500", "600", "700", "800"] });
const serif = Instrument_Serif({ subsets: ["latin"], variable: "--ff-serif", display: "swap", weight: "400", style: ["normal", "italic"] });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--ff-mono", display: "swap" });

export const metadata: Metadata = {
  title: "SokoBot — Send money across Africa",
  description: "Send money to the people who matter, across borders and currencies. See the exact rate and fees before you pay.",
};

export const viewport: Viewport = { themeColor: "#010511", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable} ${serif.variable} ${mono.variable}`}>
      <body className="grain min-h-dvh">{children}</body>
    </html>
  );
}
