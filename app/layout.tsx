import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelOS",
  description: "A personal travel journal, map, album, and memory system.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
