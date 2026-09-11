import type { ReactNode } from "react";

export const STOREFRONT_HOME_LABEL = "← 首頁";

/** Visible storefront chrome. Family uses the same copy on FamilyBackLink. */
export const STOREFRONT_HOME_LINK_CLASS =
  "inline-flex min-h-11 items-center rounded-full border border-[color:var(--line)] bg-white px-4 text-sm font-semibold text-[color:var(--pine)] shadow-sm";

/**
 * Full-document home control. Next Link + Travelpayouts Drive click patches
 * have thrown Application error on iPhone when leaving /trips or /drive.
 */
export function StorefrontHomeLink({
  children = STOREFRONT_HOME_LABEL,
  className = STOREFRONT_HOME_LINK_CLASS,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <a className={className} href="/">
      {children}
    </a>
  );
}
