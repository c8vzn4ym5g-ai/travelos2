import type { ReactNode } from "react";

export const STOREFRONT_HOME_LABEL = "← 首頁";

/** Visible storefront chrome. Family uses the same copy on FamilyBackLink. */
export const STOREFRONT_HOME_LINK_CLASS =
  "inline-flex min-h-11 cursor-pointer items-center rounded-full border border-[color:var(--line)] bg-white px-4 text-sm font-semibold text-[color:var(--pine)] shadow-sm";

/**
 * Full-document home control. A GET form is not an <a>, so Travelpayouts Drive
 * on /drive cannot patch the click the way it hijacks Next.js Links.
 */
export function StorefrontHomeLink({
  children = STOREFRONT_HOME_LABEL,
  className = STOREFRONT_HOME_LINK_CLASS,
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <form action="/" method="get">
      <button className={className} type="submit">
        {children}
      </button>
    </form>
  );
}
