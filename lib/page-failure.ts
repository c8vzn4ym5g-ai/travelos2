/** Keep diagnostics to route shape and error category, never travel text or URL keys. */
export function editingReturn(search: string) {
  const value = new URLSearchParams(search).get("returnTo") ?? "";
  if (!/^\/trips\/[a-zA-Z0-9_-]+(?:\?id=trip_[a-zA-Z0-9_-]+)?$/.test(value)) return "/trips";
  if (/^\/trips\/(admin|write|new)(?:\?|$)/.test(value)) return "/trips";
  return value;
}

export function pageFailure(error: {name?: string; message?: string; digest?: string}, pathname: string) {
  const message = error.message ?? "";
  const kind = /ChunkLoadError|Loading chunk|dynamically imported module|Failed to fetch dynamically/i.test(message) ? "page-update"
    : /timeout|timed out|逾時/i.test(message) ? "read-timeout"
    : /fetch|network|load failed/i.test(message) ? "read-failed" : "render-failed";
  const path = pathname.split(/[?#]/)[0];
  const area = path.startsWith("/trips/admin") ? "editor"
    : path.startsWith("/family/capture") ? "upload"
    : path.startsWith("/family") ? "family"
    : path.startsWith("/trips/") ? "story"
    : path.startsWith("/coffee") ? "coffee" : "library";
  return {kind, area, digest: /^\d{1,20}$/.test(error.digest ?? "") ? error.digest : undefined};
}
