import { M_PLUS_Rounded_1c, Nunito } from "next/font/google";

const bookletDisplay = M_PLUS_Rounded_1c({
  subsets: ["latin"],
  variable: "--family-display-font",
  weight: ["400", "500", "700"],
});

const bookletBody = Nunito({
  subsets: ["latin"],
  variable: "--family-body-font",
  weight: ["500", "700"],
});

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${bookletDisplay.variable} ${bookletBody.variable}`} data-surface="family">
      {children}
    </div>
  );
}
