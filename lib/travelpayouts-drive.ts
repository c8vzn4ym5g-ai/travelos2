export const TRAVELPAYOUTS_DRIVE_SCRIPT_ID = "travelpayouts-drive";
export const TRAVELPAYOUTS_DRIVE_SCRIPT_URL = "https://emrldtp.cc/NTUwMzEz.js?t=550313";
export const TRAVELOS_PATHNAME_HEADER = "x-travelos-pathname";

const privateDriveRoutes = [
  "/family",
  "/trips/write",
  "/trips/admin",
  "/coffee/admin",
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

export function travelpayoutsDriveScriptHtml(pathname: string | null | undefined) {
  if (!shouldLoadTravelpayoutsDrive(pathname)) {
    return "";
  }

  return `<script async data-cfasync="false" data-no-defer="1" data-noptimize="1" data-wpfc-render="false" id="${TRAVELPAYOUTS_DRIVE_SCRIPT_ID}" seraph-accel-crit="1" src="${TRAVELPAYOUTS_DRIVE_SCRIPT_URL}"></script>`;
}
