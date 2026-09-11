import { createHmac } from "node:crypto";
import { getDriveWarehouseToken, readPublicStatsWarehouse, recordPublicStatsWarehouse } from "@/lib/drive-warehouse";
import { isHumanBrowser, isPublicStorefront, PUBLIC_ORIGIN, UUID_PATTERN, validStats, VISITOR_COOKIE } from "@/lib/public-stats";

export async function readPublicStats() {
  const result = await readPublicStatsWarehouse();
  if (!validStats(result)) throw new Error("Stats warehouse unavailable or not deployed");
  return result;
}

export async function acceptPublicView(request: Request) {
  if (new URL(request.url).origin !== PUBLIC_ORIGIN || request.headers.get("origin") !== PUBLIC_ORIGIN
    || !isHumanBrowser(request.headers.get("user-agent") || "")
    || request.headers.get("sec-fetch-site") === "cross-site") return false;
  const visitor = request.headers.get("cookie")?.split(/;\s*/).find(v => v.startsWith(`${VISITOR_COOKIE}=`))?.slice(VISITOR_COOKIE.length + 1);
  if (!visitor || !UUID_PATTERN.test(visitor)) return false;
  // Read a bounded stream rather than trusting Content-Length from a public client.
  const reader = request.body?.getReader();
  if (!reader) return false;
  let text = "";
  let size = 0;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024) { await reader.cancel(); return false; }
    text += decoder.decode(value, { stream: true });
  }
  let body;
  try { body = JSON.parse(text + decoder.decode()); } catch { return false; }
  if (!body || typeof body.path !== "string" || !isPublicStorefront(body.path)
    || typeof body.event !== "string" || !UUID_PATTERN.test(body.event)) return false;
  try {
    const referrer = new URL(request.headers.get("referer") || "");
    if (referrer.origin !== PUBLIC_ORIGIN || referrer.pathname !== body.path) return false;
  } catch { return false; }
  // No IP, user agent, referrer, raw cookie, or journal data is stored in Drive.
  const hash = createHmac("sha256", getDriveWarehouseToken()).update(`public-stats:${visitor}`).digest("hex");
  const result = await recordPublicStatsWarehouse(hash, body.event);
  if (!result || typeof result !== "object" || (result as { ok?: unknown }).ok !== true) {
    throw new Error("Stats write failed");
  }
  return true;
}
