import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TravelOS | Travel Journals and Coffee Notes",
    template: "%s | TravelOS",
  },
  description: "A personal travel journal, coffee map, photo album, and memory system.",
  metadataBase: new URL("https://travelos2-63r3.vercel.app"),
  openGraph: {
    description: "A personal travel journal, coffee map, photo album, and memory system.",
    siteName: "TravelOS",
    title: "TravelOS",
    type: "website",
    url: "https://travelos2-63r3.vercel.app",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
