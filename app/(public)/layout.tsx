import { TravelpayoutsDrive } from "@/components/travelpayouts-drive";

export default function PublicLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <TravelpayoutsDrive />
      {children}
    </>
  );
}
