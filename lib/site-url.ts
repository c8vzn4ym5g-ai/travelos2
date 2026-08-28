/** Canonical public origin for storefront pages (sitemap, robots, OG, JSON-LD, share links). */
export const PUBLIC_SITE_ORIGIN = "https://travelos2.chao-jason.workers.dev";

/** Cold-spare Vercel production. Keep the GitHub → Vercel deploy path. Do not delete. */
export const VERCEL_SPARE_ORIGIN = "https://travelos2-63r3.vercel.app";

export function publicSiteUrl(path = "/") {
  if (!path || path === "/") {
    return PUBLIC_SITE_ORIGIN;
  }

  return `${PUBLIC_SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}
