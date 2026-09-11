export const VISITOR_COOKIE = "travelos_visitor";
export const PUBLIC_ORIGIN = "https://travelos2.chao-jason.workers.dev";
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPublicStorefront(path: string) {
  if (!path.startsWith("/") || path.includes("%") || path.includes("\\") || path.includes("//")) return false;
  const clean = path.split(/[?#]/)[0].replace(/\/$/, "") || "/";
  if (/^\/trips\/(write|admin|new)(\/|$)/.test(clean)) return false;
  // Trip detail pages have one slug. Assets and nested management routes are not views.
  return ["/", "/trips", "/coffee", "/drive"].includes(clean) || /^\/trips\/[^/.]+$/.test(clean);
}

export function isHumanBrowser(userAgent: string) {
  return /Mozilla\//i.test(userAgent) && !/bot|crawler|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|facebot|preview|curl|wget|python|httpclient|travelos/i.test(userAgent);
}

export type PublicStats = {
  todayUV: number;
  todayPV: number;
  days: { date: string; uv: number; pv: number }[];
  since: string | null;
  totalUVApprox: number;
  goalUVApprox: number;
  goal: number;
  deadline: string;
  timezone: string;
};

export function validStats(value: unknown): value is PublicStats {
  if (!value || typeof value !== "object") return false;
  const s = value as PublicStats;
  const count = (n: unknown) => Number.isSafeInteger(n) && Number(n) >= 0;
  return count(s.todayUV) && count(s.todayPV) && count(s.totalUVApprox) && count(s.goalUVApprox)
    && s.goal === 300 && s.deadline === "2026-09-21" && s.timezone === "Asia/Taipei"
    && (s.since === null || (typeof s.since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.since)))
    && Array.isArray(s.days) && s.days.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d.date) && count(d.uv) && count(d.pv));
}
