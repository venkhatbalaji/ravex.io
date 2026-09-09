import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { NavBar } from "@/components/nav-bar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter-loaded",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-mono-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Predict Play Admin",
  description: "Manage markets, categories, and white-label branding.",
};

const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem('ravex.admin.theme')==='light'){document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>
          <NavBar />
          <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
