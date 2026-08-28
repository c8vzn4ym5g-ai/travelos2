/** Cloudflare workers.dev — production canonical for storefront metadata and share links. */
export const DEFAULT_PUBLIC_SITE_ORIGIN = "https://travelos2.chao-jason.workers.dev";

/** Cold-spare Vercel production. Keep the GitHub → Vercel deploy path. Do not delete. */
export const VERCEL_SPARE_ORIGIN = "https://travelos2-63r3.vercel.app";

type EnvLike = Record<string, string | undefined>;

function parseHttpOrigin(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function isVercelAppOrigin(origin: string) {
  try {
    return new URL(origin).hostname.endsWith(".vercel.app");
  } catch {
    return false;
  }
}

/**
 * Public storefront origin for metadataBase, sitemap, robots, JSON-LD, and share links.
 * Reads NEXT_PUBLIC_SITE_URL then SITE_URL. Defaults to Cloudflare workers.dev.
 * Ignores *.vercel.app so leftover Vercel dashboard env cannot advertise the spare.
 */
export function resolvePublicSiteOrigin(env: EnvLike = process.env) {
  for (const raw of [env.NEXT_PUBLIC_SITE_URL, env.SITE_URL]) {
    const origin = parseHttpOrigin(raw);
    if (origin && !isVercelAppOrigin(origin)) {
      return origin;
    }
  }

  return DEFAULT_PUBLIC_SITE_ORIGIN;
}

export const PUBLIC_SITE_ORIGIN = resolvePublicSiteOrigin();

export function publicSiteUrl(path = "/", env: EnvLike = process.env) {
  const origin = resolvePublicSiteOrigin(env);
  if (!path || path === "/") {
    return origin;
  }

  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}
