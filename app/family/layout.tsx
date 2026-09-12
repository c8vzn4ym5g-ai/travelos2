import type { Metadata, Viewport } from "next";
import "./family.css";

export const metadata: Metadata = { manifest: "/family/manifest.webmanifest" };

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#F0F6E4",
};

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="family-workshop"
      data-surface="family"
    >
      {children}
    </div>
  );
}
