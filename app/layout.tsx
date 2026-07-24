import type { Metadata, Viewport } from "next";
import { TravelpayoutsDrive } from "@/components/travelpayouts-drive";
import "./globals.css";

const appName = "TravelOS";
const appDescription = "A personal travel journal, coffee map, photo album, and memory system.";
const appUrl = "https://travelos2-63r3.vercel.app";
const iconUrl = "/travelos-icon.png";

export const metadata: Metadata = {
  applicationName: appName,
  appleWebApp: {
    capable: true,
    startupImage: [iconUrl],
    statusBarStyle: "default",
    title: appName,
  },
  authors: [{ name: "TravelOS" }],
  category: "travel",
  title: {
    default: "TravelOS | Travel Journals and Coffee Notes",
    template: "%s | TravelOS",
  },
  description: appDescription,
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  icons: {
    apple: [{ sizes: "512x512", url: iconUrl }],
    icon: [{ sizes: "512x512", type: "image/png", url: iconUrl }],
    shortcut: [iconUrl],
  },
  manifest: "/manifest.webmanifest",
  metadataBase: new URL(appUrl),
  openGraph: {
    description: appDescription,
    images: [{ alt: "TravelOS app icon", height: 512, url: iconUrl, width: 512 }],
    siteName: appName,
    title: appName,
    type: "website",
    url: appUrl,
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": appName,
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <TravelpayoutsDrive />
      </body>
    </html>
  );
}
