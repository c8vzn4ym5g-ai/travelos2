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
    <form action={href} className="inline-flex" method="get">
      <button className={`fam-back ${className}`.trim()} type="submit">
        {children}
      </button>
    </form>
  );
}
