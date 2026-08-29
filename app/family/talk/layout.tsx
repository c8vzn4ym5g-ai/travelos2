import type { Metadata, Viewport } from "next";
import "./talk.css";

const title = "家庭說話";
const description = "九州旅行用的中日口譯。你說中文，或把手機對準對方。";
const iconUrl = "/family/talk/apple-touch-icon.png";

export const metadata: Metadata = {
  applicationName: title,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title,
  },
  description,
  icons: {
    apple: [{ sizes: "180x180", url: iconUrl }],
    icon: [{ sizes: "180x180", type: "image/png", url: iconUrl }],
  },
  manifest: "/family/talk/manifest.webmanifest",
  title,
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": title,
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#F0F6E4",
};

export default function FamilyTalkLayout({ children }: { children: React.ReactNode }) {
  return children;
}
