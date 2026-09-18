import type { Metadata, Viewport } from "next";
import "./family.css";

export const metadata: Metadata = {
  applicationName: "TravelOS 編輯版",
  title: "TravelOS 編輯版",
  description: "上傳素材、確認進倉、生成架構、檢查缺漏。",
  manifest: "/family/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TravelOS 編輯版",
  },
  icons: {
    apple: [{ sizes: "512x512", url: "/travelos-edit-icon.png" }],
    icon: [{ sizes: "512x512", type: "image/png", url: "/travelos-edit-icon.png" }],
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "default",
    "apple-mobile-web-app-title": "TravelOS 編輯版",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#c45c4a",
};

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="family-workshop" data-surface="family">
      {children}
    </div>
  );
}
