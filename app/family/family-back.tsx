import Link from "next/link";
import type { ReactNode } from "react";

export function FamilyBackLink({
  children,
  className = "min-h-11",
  href,
}: {
  children: ReactNode;
  className?: string;
  href: string;
}) {
  return (
    <Link className={`fam-back ${className}`.trim()} href={href}>
      {children}
    </Link>
  );
}
