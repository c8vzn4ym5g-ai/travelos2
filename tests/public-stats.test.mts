import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { isPublicStorefront, isHumanBrowser, PUBLIC_ORIGIN, VISITOR_COOKIE } from "../lib/public-stats.ts";
import { acceptPublicView, readPublicStats } from "../lib/public-stats-server.ts";
import { setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";

const visitor = "12345678-1234-4123-8123-123456789abc";
const event = "12345678-1234-4123-8123-123456789abd";
const browser = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1";

test("only storefront pages; exclude controls, media, encoded and unknown paths", () => {
  for (const path of ["/", "/trips", "/trips/lapland", "/coffee", "/drive", "/trips/lapland/"]) assert.ok(isPublicStorefront(path), path);
  for (const path of ["/family", "/family/stats", "/trips/write", "/trips/write/x", "/trips/admin", "/trips/new", "/coffee/admin", "/admin", "/api/stats", "/api/media", "/trips/photo.jpg", "/trips/a/media", "/trips/%61dmin", "//trips/a", "/unknown"]) assert.equal(isPublicStorefront(path), false, path);
  assert.ok(isHumanBrowser(browser));
  for (const ua of ["", "curl/8", "Mozilla/5.0 Googlebot", "Mozilla/5.0 HeadlessChrome", "Mozilla/5.0 facebookexternalhit", "TravelOS media"]) assert.equal(isHumanBrowser(ua), false);
});

function request(body: unknown = { path: "/trips/lapland", event }, overrides: Record<string, string> = {}) {
  return new Request(`${PUBLIC_ORIGIN}/api/stats`, { method: "POST", headers: { origin: PUBLIC_ORIGIN, referer: `${PUBLIC_ORIGIN}/trips/lapland`, "user-agent": browser, cookie: `${VISITOR_COOKIE}=${visitor}`, ...overrides }, body: JSON.stringify(body) });
}

test("server validates events and stores only hashed identity; warehouse errors stay errors", async () => {
  const payloads: Record<string, unknown>[] = [];
  setDriveWarehouseFetchForTests(async (_url, init) => {
    payloads.push(JSON.parse(String(init?.body)));
    return Response.json({ ok: true });
  });
  try {
    assert.equal(await acceptPublicView(request()), true);
    assert.equal(payloads[0].op, "stats");
    assert.match(String(payloads[0].visitor), /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(payloads).includes(visitor));
    assert.equal(payloads[0].path, undefined);
    for (const headers of [{ origin: "https://evil.example" }, { cookie: "" }, { "user-agent": "Googlebot" }, { referer: `${PUBLIC_ORIGIN}/family` }]) assert.equal(await acceptPublicView(request(undefined, headers)), false);
    assert.equal(await acceptPublicView(request({ path: "/api/media", event })), false);
    assert.equal(await acceptPublicView(request({ path: "/", event: "bad" })), false);
    assert.equal(await acceptPublicView(request({ padding: "x".repeat(2000) })), false);
    assert.equal(payloads.length, 1);
    setDriveWarehouseFetchForTests(async () => Response.json({ error: "missing id" }));
    await assert.rejects(readPublicStats, /unavailable/);
    await assert.rejects(() => acceptPublicView(request()), /write failed/);
  } finally { setDriveWarehouseFetchForTests(null); }
});

test("Drive script lock, persistence, Taipei midnight, replay dedup, totals and deadline", () => {
  let contents: string | null = null;
  let now = "2026-09-11T15:59:59Z";
  let locked = false;
  const file = { getBlob: () => ({ getDataAsString: () => contents }), setContent: (s: string) => { assert.ok(locked); contents = s; } };
  const sandbox = vm.createContext({
    Date: class extends Date { constructor() { super(now); } },
    Utilities: { formatDate: (d: Date, zone: string) => { assert.equal(zone, "Asia/Taipei"); return new Date(d.getTime() + 8 * 3600000).toISOString().slice(0, 10); } },
    LockService: { getScriptLock: () => ({ waitLock: () => { assert.equal(locked, false); locked = true; }, releaseLock: () => { locked = false; } }) },
    DriveApp: { getFolderById: () => ({ getFilesByName: (name: string) => { assert.equal(name, "travelos-public-stats-v1.json"); return { hasNext: () => contents !== null, next: () => file }; }, createFile: (_name: string, text: string) => { assert.ok(locked); contents = text; } }) },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: (text: string) => ({ setMimeType: () => JSON.parse(text) }) },
  });
  vm.runInContext(readFileSync(new URL("../scripts/drive-warehouse-apps-script.js", import.meta.url), "utf8"), sandbox);
  const call = (code: string) => vm.runInContext(code, sandbox);
  const get = () => call('doGet({parameter:{op:"stats", token:TOKEN}})');
  const post = (hash: string, id: string) => { sandbox.body = { op: "stats", visitor: hash.repeat(64), event: id }; return call('doPost({postData:{contents:JSON.stringify(Object.assign({},body,{token:TOKEN}))}})'); };
  assert.equal(get().since, null);
  assert.equal(post("a", event).ok, true);
  post("a", event);
  post("a", visitor);
  assert.equal(get().todayUV, 1);
  assert.equal(get().todayPV, 2);
  now = "2026-09-11T16:00:00Z";
  assert.equal(get().todayUV, 0);
  post("a", event); // yesterday's replay is still ignored
  assert.equal(get().todayPV, 0);
  post("a", "22345678-1234-4123-8123-123456789abd");
  assert.equal(get().days[1].date, "2026-09-12");
  assert.equal(get().todayUV, 1);
  assert.equal(get().totalUVApprox, 1);
  post("b", "32345678-1234-4123-8123-123456789abd");
  assert.equal(get().todayUV, 2);
  now = "2026-09-21T16:00:00Z";
  post("c", "42345678-1234-4123-8123-123456789abd");
  assert.equal(get().totalUVApprox, 3);
  assert.equal(get().goalUVApprox, 2);
  assert.ok(!JSON.stringify(get()).includes("aaaa"));
  assert.equal(locked, false);
  contents = "broken";
  assert.throws(get);
  assert.equal(contents, "broken");
  assert.equal(locked, false);
});

test("public stats beacon follows App Router pathname and never patches history", () => {
  const beacon = readFileSync(new URL("../components/public-stats-beacon.tsx", import.meta.url), "utf8");
  assert.match(beacon, /usePathname/);
  assert.match(beacon, /never throw into the storefront/);
  assert.doesNotMatch(beacon, /history\.pushState/);
  assert.doesNotMatch(beacon, /history\.replaceState/);
});
