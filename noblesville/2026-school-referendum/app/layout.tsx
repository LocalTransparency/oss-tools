import type { Metadata } from "next";
import { Public_Sans, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Gtm from "@/components/Gtm";

// Self-hosted at build time (no font-CDN request → no visitor data leaks to a
// third party). Bound to the design tokens' font variables in globals.css.
const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Applies a theme forced elsewhere on this origin (e.g. the CMS theme toggle
// writes localStorage['lt-theme']) before first paint, so a visitor's choice
// carries from the main site into this tool with no flash. Absent/auto lets the
// design system's prefers-color-scheme decide.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('lt-theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export const metadata: Metadata = {
  title: 'Noblesville Referendum Tax Estimator',
  description:
    'Neutral, sourced estimates of your Noblesville property tax bill if the 2026 Noblesville Schools referendum passes or fails.',
};

// GTM_ID is read server-side at render time (not build time), and is
// deliberately NOT a NEXT_PUBLIC_ var, so it can be set on the platform later
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
      className={`${publicSans.variable} ${sourceSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        {gtmId && <Gtm id={gtmId} />}
        <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 px-6 pt-6">
          {/* Plain <a> (not next/link) so it escapes this tool's basePath and
              lands on the main site root (the CMS) in production. */}
          <a href="/" className="font-serif text-base font-semibold text-fg">Local Transparency</a>
          <a
            className="inline-flex h-11 w-11 items-center justify-center text-muted hover:text-fg"
            href="https://github.com/LocalTransparency/oss-tools"
            aria-label="Local Transparency open-source tools on GitHub (opens in new tab)"
            target="_blank"
            rel="noopener noreferrer"
          >
            <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
        </header>
        {children}
        <footer className="mx-auto max-w-3xl p-6 text-xs text-muted">
          This site is not affiliated with Noblesville Schools or any campaign. Estimates only — not a
          bill. Addresses you search are never stored, logged, or sent to analytics. Basic anonymous
          usage statistics are collected.
        </footer>
      </body>
    </html>
  );
}
