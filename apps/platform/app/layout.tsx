import type { Metadata } from "next";
import { Fredoka, JetBrains_Mono, Nunito, Poppins, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/nav-bar";
import { RevealController } from "@/components/reveal-controller";

// The short, fixed list of fonts an admin can pick from (services/branding's
// SupportedFont enum) — all four load here so switching is just a CSS
// variable change at runtime, no rebuild. The tradeoff: the bundle always
// ships all four font files rather than just the active one.
const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Predict Play",
  description: "Free-to-play, pari-mutuel cricket prediction markets.",
  icons: {
    icon: [
      { url: "/png/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/png/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/png/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/png/android-chrome-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/png/apple-touch-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

// Dark is the default with no localStorage entry at all — this only ever
// needs to *add* the light override, and it has to run before first paint
// (a plain useEffect would flash dark-then-light on every reload).
const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('ravex.platform.theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fredoka.variable} ${nunito.variable} ${poppins.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <RevealController />
          <NavBar />
          <main className="relative z-[1] mx-auto max-w-5xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
