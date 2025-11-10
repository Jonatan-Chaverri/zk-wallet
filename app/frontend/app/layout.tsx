import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "./polyfills"; // Load Buffer polyfill for @aztec/bb.js
import { Providers } from "./providers";

export const dynamic = 'force-dynamic';

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "zkWallet - Privacy-Preserving Wallet",
  description: "A privacy-preserving wallet for Arbitrum Stylus with zero-knowledge proofs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
