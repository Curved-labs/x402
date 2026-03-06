import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://crif.fun";
const SITE_NAME = "crif";
const DESCRIPTION =
  "Transaction legibility engine for Solana. Decodes instructions, diffs state, detects the Drift 2026 exploit pattern. Offline. Rust. Open source.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "crif // see what you sign",
    template: "%s // crif",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  keywords: [
    "solana",
    "transaction-simulation",
    "legibility",
    "security",
    "anchor",
    "squads",
    "multisig",
    "drift-exploit",
    "durable-nonce",
    "rust",
    "defi-security",
    "audit-tooling",
  ],
  authors: [{ name: "crif" }],
  creator: "crif",
  publisher: "crif",
  referrer: "origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: SITE_URL,
    languages: {
      en: `${SITE_URL}/`,
      "x-default": `${SITE_URL}/`,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "crif // see what you sign",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "crif — transaction legibility engine for Solana",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "crif // see what you sign",
    description: DESCRIPTION,
    images: ["/twitter-image"],
    creator: "@crif_fun",
  },
  category: "technology",
  classification: "developer-tools, blockchain-security",
  other: {
    "color-scheme": "dark",
    "format-detection": "telephone=no,address=no,email=no",
  },
};

export const viewport: Viewport = {
  themeColor: "#070709",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};
