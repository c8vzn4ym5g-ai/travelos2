import type { Viewport } from "next";
import { Caveat, M_PLUS_Rounded_1c, Nunito } from "next/font/google";
import "./family.css";

const rounded = M_PLUS_Rounded_1c({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-fam-rounded",
  weight: ["400", "500", "700"],
});

const nunito = Nunito({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-fam-nunito",
  weight: ["400", "600", "700"],
});

const caveat = Caveat({
  display: "swap",
  subsets: ["latin", "latin-ext"],
  variable: "--font-fam-caveat",
  weight: ["500", "600"],
});

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#FFF4EC",
};

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${rounded.variable} ${nunito.variable} ${caveat.variable} family-workshop`}
      data-surface="family"
    >
      {children}
    </div>
  );
}
