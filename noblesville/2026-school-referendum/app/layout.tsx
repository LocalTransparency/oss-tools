import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Gtm from "@/components/Gtm";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Noblesville Referendum Tax Estimator',
  description:
    'Neutral, sourced estimates of your Noblesville property tax bill if the 2026 Noblesville Schools referendum passes or fails.',
};

// GTM_ID is read server-side at render time (not build time), and is
// deliberately NOT a NEXT_PUBLIC_ var, so it can be set on App Runner later
// without a rebuild. force-dynamic keeps this layout from being statically
// prerendered at build time, which would otherwise bake in whatever GTM_ID
// (or lack of it) was set at build.
export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gtmId = process.env.GTM_ID;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {gtmId && <Gtm id={gtmId} />}
        {children}
        <footer className="mx-auto max-w-3xl p-6 text-xs text-gray-600 dark:text-gray-400">
          This site is not affiliated with Noblesville Schools or any campaign. Estimates only — not a
          bill. Addresses you search are never stored, logged, or sent to analytics. Basic anonymous
          usage statistics are collected.
        </footer>
      </body>
    </html>
  );
}
