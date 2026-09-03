import type { Metadata, Viewport } from "next";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Ravex — Build what moves business forward", template: "%s · Ravex" },
  description: "Ravex creates secure fintech platforms, practical AI solutions and people-first HR technology for ambitious companies.",
  keywords: ["fintech development", "AI solutions", "HR technology", "digital transformation", "software company"],
  openGraph: {
    title: "Ravex — Ideas engineered for impact",
    description: "Fintech, AI and HR technology built for the real world.",
    url: "/",
    siteName: "Ravex",
    type: "website",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Ravex" }],
  },
  twitter: { card: "summary_large_image", title: "Ravex", description: "Ideas engineered for impact.", images: ["/opengraph-image"] },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#07110f", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
