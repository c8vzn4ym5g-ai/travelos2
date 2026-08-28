export const TRAVELPAYOUTS_DRIVE_SCRIPT_ID = "travelpayouts-drive";
/** Cloudflare workers.dev Travelpayouts project (source 567750). Canonical public host. */
export const TRAVELPAYOUTS_DRIVE_SCRIPT_CLOUDFLARE_URL = "https://emrldtp.cc/NTY3NzUw.js?t=567750";
/** Vercel travelos2-63r3 cold-spare Travelpayouts project (source 550313). */
export const TRAVELPAYOUTS_DRIVE_SCRIPT_VERCEL_URL = "https://emrldtp.cc/NTUwMzEz.js?t=550313";
/** Default production Drive script: Cloudflare / workers.dev. */
export const TRAVELPAYOUTS_DRIVE_SCRIPT_URL = TRAVELPAYOUTS_DRIVE_SCRIPT_CLOUDFLARE_URL;
export const TRAVELOS_DRIVE_SRC_ENV = "TRAVELOS_TRAVELPAYOUTS_DRIVE_SRC";
export const TRAVELOS_PATHNAME_HEADER = "x-travelos-pathname";

type DriveScriptOptions = {
  host?: string | null;
};

function normalizeHost(host: string | null | undefined) {
  const raw = host?.split(",")[0]?.trim().toLowerCase() ?? "";
  return raw.split(":")[0] ?? "";
}

function driveScriptFromEnv(raw: string | undefined) {
  const value = raw?.trim();
  if (!value) {
    return null;
  }

  if (value === "567750" || value.includes("NTY3NzUw") || value === TRAVELPAYOUTS_DRIVE_SCRIPT_CLOUDFLARE_URL) {
    return TRAVELPAYOUTS_DRIVE_SCRIPT_CLOUDFLARE_URL;
  }

  if (value === "550313" || value.includes("NTUwMzEz") || value === TRAVELPAYOUTS_DRIVE_SCRIPT_VERCEL_URL) {
    return TRAVELPAYOUTS_DRIVE_SCRIPT_VERCEL_URL;
  }

  return null;
}

export function travelpayoutsDriveScriptUrl(options: DriveScriptOptions = {}) {
  const override = driveScriptFromEnv(process.env[TRAVELOS_DRIVE_SRC_ENV]);
  if (override) {
    return override;
  }

  const host = normalizeHost(options.host);
  if (host.endsWith(".vercel.app")) {
    return TRAVELPAYOUTS_DRIVE_SCRIPT_VERCEL_URL;
  }

  if (host.endsWith(".workers.dev")) {
    return TRAVELPAYOUTS_DRIVE_SCRIPT_CLOUDFLARE_URL;
  }

  if (process.env.VERCEL) {
    return TRAVELPAYOUTS_DRIVE_SCRIPT_VERCEL_URL;
  }

  return TRAVELPAYOUTS_DRIVE_SCRIPT_CLOUDFLARE_URL;
}

const privateDriveRoutes = [
  "/family",
  "/trips/write",
  "/trips/admin",
  "/trips/new",
  "/coffee/admin",
  "/coffee/new",
  "/admin",
  "/api",
] as const;

function normalizePathname(pathname: string) {
  const pathOnly = pathname.split("?")[0]?.split("#")[0] ?? pathname;
  if (pathOnly.length > 1 && pathOnly.endsWith("/")) {
    return pathOnly.slice(0, -1);
  }
  return pathOnly || "/";
}

function matchesRoute(pathname: string, route: string) {
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function shouldLoadTravelpayoutsDrive(pathname: string | null | undefined) {
  if (!pathname) {
    return false;
  }

  const normalized = normalizePathname(pathname);
  return !privateDriveRoutes.some((route) => matchesRoute(normalized, route));
}

export function pathnameFromRequestHeaders(headerStore: { get(name: string): string | null }) {
  const explicit = headerStore.get(TRAVELOS_PATHNAME_HEADER);
  if (explicit) {
    return normalizePathname(explicit);
  }

  const nextUrl = headerStore.get("next-url");
  if (nextUrl) {
    try {
      return normalizePathname(new URL(nextUrl, "http://localhost").pathname);
    } catch {
      if (nextUrl.startsWith("/")) {
        return normalizePathname(nextUrl);
      }
    }
  }

  const invokePath = headerStore.get("x-invoke-path") ?? headerStore.get("x-matched-path");
  if (invokePath) {
    return normalizePathname(invokePath.startsWith("/") ? invokePath : `/${invokePath}`);
  }

  return "";
}

export function travelpayoutsDriveScriptHtml(pathname: string | null | undefined, options: DriveScriptOptions = {}) {
  if (!shouldLoadTravelpayoutsDrive(pathname)) {
    return "";
  }

  const src = travelpayoutsDriveScriptUrl(options);
  return `<script async data-cfasync="false" data-no-defer="1" data-noptimize="1" data-wpfc-render="false" id="${TRAVELPAYOUTS_DRIVE_SCRIPT_ID}" seraph-accel-crit="1" src="${src}"></script>`;
}
