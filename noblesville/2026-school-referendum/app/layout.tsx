import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="mx-auto max-w-3xl p-6 text-xs text-gray-600 dark:text-gray-400">
          This site is not affiliated with Noblesville Schools or any campaign. Estimates only — not a
          bill. No addresses or lookups are stored.
        </footer>
      </body>
    </html>
  );
}
