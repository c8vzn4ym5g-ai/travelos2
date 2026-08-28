import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import {
  TRAVELOS_DRIVE_WAREHOUSE_TOKEN,
  TRAVELOS_DRIVE_WAREHOUSE_URL,
  driveObjectName,
  driveStorageKey,
  getBinary,
  getDriveWarehouseToken,
  getDriveWarehouseUrl,
  getIndex,
  parseDriveFileId,
  putBinary,
  putIndex,
  putItem,
  scanWarehouseFiles,
  setDriveWarehouseFetchForTests,
} from "../lib/drive-warehouse.ts";
import { createTravelMoment } from "../lib/moments.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

async function listFiles(dir: string, acc: string[] = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".next") {
        continue;
      }
      await listFiles(path, acc);
    } else if (/\.(ts|tsx|js|mjs|mts)$/.test(entry.name)) {
      acc.push(path);
    }
  }
  return acc;
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

test("Drive storage keys are drive:fileId", () => {
  assert.equal(driveStorageKey("1abc"), "drive:1abc");
  assert.equal(parseDriveFileId("drive:1abc"), "1abc");
  assert.equal(parseDriveFileId("https://blob.example/x.jpg"), null);
  assert.equal(driveObjectName("travelos/moments/photos/a/b.jpg"), "travelos__moments__photos__a__b.jpg");
});

test("getIndex, putIndex, putItem, putBinary, and getBinary use a fake fetch", async () => {
  const calls: Array<{ body: string | null; method: string; url: string }> = [];
  const files = new Map<string, { base64: string; mimeType: string; name: string }>();
  const items = new Map<string, string>();
  let indexText = JSON.stringify({ jobs: [], moments: [], schemaVersion: 1, updatedAt: "2026-08-28T00:00:00.000Z" });

  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? init.body : null;
    calls.push({ body, method, url });
    assert.match(url, /script\.google\.com\/macros\/s\/|script\.googleusercontent\.com/);
    assert.doesNotMatch(url, /blob\.vercel-storage\.com/);

    if (method === "GET") {
      const parsed = new URL(url);
      assert.equal(parsed.searchParams.get("token"), TRAVELOS_DRIVE_WAREHOUSE_TOKEN);
      if (parsed.searchParams.get("op") === "index") {
        return jsonResponse(JSON.parse(indexText));
      }
      if (parsed.searchParams.get("op") === "list") {
        return jsonResponse({
          files: [...files.entries()].map(([id, file]) => ({
            id,
            mimeType: file.mimeType,
            name: file.name,
          })),
        });
      }
      const id = parsed.searchParams.get("id") ?? "";
      const file = files.get(id);
      assert.ok(file);
      return jsonResponse({ id, mimeType: file.mimeType, name: file.name, base64: file.base64 });
    }

    assert.equal(method, "POST");
    assert.equal(url, TRAVELOS_DRIVE_WAREHOUSE_URL);
    const payload = JSON.parse(body ?? "{}") as {
      base64?: string;
      mimeType?: string;
      name?: string;
      op?: string;
      text?: string;
      token?: string;
    };
    assert.equal(payload.token, TRAVELOS_DRIVE_WAREHOUSE_TOKEN);

    if (payload.op === "index") {
      indexText = payload.text ?? indexText;
      return jsonResponse({ ok: true, name: "moments.json" });
    }
    if (payload.op === "item") {
      items.set(payload.name ?? "", payload.text ?? "");
      return jsonResponse({ ok: true, name: payload.name });
    }
    const id = "file_tiny_1";
    files.set(id, {
      base64: payload.base64 ?? "",
      mimeType: payload.mimeType ?? "application/octet-stream",
      name: payload.name ?? "file.bin",
    });
    return jsonResponse({ id, name: payload.name });
  }) as typeof fetch;

  const empty = await getIndex(fakeFetch);
  assert.deepEqual(empty.moments, []);
  assert.deepEqual(empty.jobs, []);

  const moment = createTravelMoment({ note: "drive-item", time: "2026-08-28T09:00:00.000Z" });
  const itemName = driveObjectName(`travelos/moments/items/${moment.id}.json`);
  const itemSaved = await putItem(itemName, JSON.stringify({ moment }), fakeFetch);
  assert.equal(itemSaved.ok, true);
  assert.equal(JSON.parse(items.get(itemName) ?? "{}").moment.id, moment.id);

  const indexBody = JSON.stringify({
    jobs: [],
    moments: [moment],
    schemaVersion: 2,
    updatedAt: "2026-08-28T09:00:00.000Z",
  });
  const indexSaved = await putIndex(indexBody, fakeFetch);
  assert.equal(indexSaved.name, "moments.json");
  const listed = await getIndex(fakeFetch);
  assert.equal(listed.moments[0]?.id, moment.id);
  assert.equal(listed.moments[0]?.note, "drive-item");

  const bytes = new Uint8Array([1, 2, 3, 4]);
  const stored = await putBinary(
    { bytes, mimeType: "image/jpeg", name: "travelos__moments__photos__tiny.jpg" },
    fakeFetch,
  );
  assert.equal(stored.id, "file_tiny_1");
  const listedFiles = await scanWarehouseFiles(fakeFetch);
  assert.equal(listedFiles[0]?.id, "file_tiny_1");
  assert.equal(listedFiles[0]?.name, "travelos__moments__photos__tiny.jpg");
  const loaded = await getBinary(stored.id, fakeFetch);
  assert.deepEqual([...loaded?.bytes ?? []], [1, 2, 3, 4]);
  assert.equal(loaded?.mimeType, "image/jpeg");
  assert.equal(
    calls.some((call) => call.url.startsWith("https://script.google.com/") && call.method === "POST"),
    true,
  );
});

test("getBinary runs at most two Drive file GETs at a time", async () => {
  let started = 0;
  let maxStarted = 0;
  setDriveWarehouseFetchForTests((async (input) => {
    const parsed = new URL(String(input));
    started += 1;
    maxStarted = Math.max(maxStarted, started);
    await new Promise((resolve) => setTimeout(resolve, 40));
    started -= 1;
    return Response.json({
      id: parsed.searchParams.get("id") ?? "file",
      mimeType: "image/jpeg",
      name: "photo.jpg",
      base64: Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64"),
    });
  }) as typeof fetch);

  try {
    await Promise.all([getBinary("a"), getBinary("b"), getBinary("c"), getBinary("d")]);
    assert.ok(maxStarted <= 2);
  } finally {
    setDriveWarehouseFetchForTests(null);
  }
});

test("POST JSON to /exec survives a Google 302 by sending the body before following", async () => {
  let postedBody: string | null = null;
  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "POST" && url === TRAVELOS_DRIVE_WAREHOUSE_URL) {
      postedBody = typeof init?.body === "string" ? init.body : null;
      assert.equal(init?.redirect, "manual");
      return new Response(null, {
        headers: { location: "https://script.googleusercontent.com/macros/echo?result=1" },
        status: 302,
      });
    }
    if (method === "GET" && url.includes("script.googleusercontent.com")) {
      const payload = JSON.parse(postedBody ?? "{}") as { name?: string; op?: string; text?: string };
      assert.equal(payload.op, "index");
      assert.ok(payload.text?.includes("moment_redirect"));
      return jsonResponse({ ok: true, name: "moments.json" });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;

  const saved = await putIndex(
    JSON.stringify({ jobs: [], moments: [{ id: "moment_redirect" }], schemaVersion: 1, updatedAt: "2026-08-28T00:00:00.000Z" }),
    fakeFetch,
  );
  assert.equal(saved.ok, true);
  assert.ok(postedBody);
  assert.match(postedBody, /moment_redirect/);
});

test("Drive warehouse live fetch is not used from unit tests", async () => {
  await assert.rejects(() => getIndex(), /disabled in unit tests/);
});

test("Drive warehouse URL and token can be overridden with server env", async () => {
  const previousUrl = process.env.TRAVELOS_DRIVE_WAREHOUSE_URL;
  const previousToken = process.env.TRAVELOS_DRIVE_WAREHOUSE_TOKEN;
  process.env.TRAVELOS_DRIVE_WAREHOUSE_URL = "https://script.google.com/macros/s/cf-override/exec";
  process.env.TRAVELOS_DRIVE_WAREHOUSE_TOKEN = "cf-override-token";
  try {
    assert.equal(getDriveWarehouseUrl(), "https://script.google.com/macros/s/cf-override/exec");
    assert.equal(getDriveWarehouseToken(), "cf-override-token");
    const calls: string[] = [];
    const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      const url = String(input);
      calls.push(url);
      assert.equal((init?.method ?? "GET").toUpperCase(), "GET");
      const parsed = new URL(url);
      assert.equal(parsed.origin + parsed.pathname, "https://script.google.com/macros/s/cf-override/exec");
      assert.equal(parsed.searchParams.get("token"), "cf-override-token");
      return jsonResponse({ jobs: [], moments: [], schemaVersion: 1, updatedAt: "2026-08-28T00:00:00.000Z" });
    }) as typeof fetch;
    await getIndex(fakeFetch);
    assert.equal(calls.length, 1);
  } finally {
    if (previousUrl === undefined) {
      delete process.env.TRAVELOS_DRIVE_WAREHOUSE_URL;
    } else {
      process.env.TRAVELOS_DRIVE_WAREHOUSE_URL = previousUrl;
    }
    if (previousToken === undefined) {
      delete process.env.TRAVELOS_DRIVE_WAREHOUSE_TOKEN;
    } else {
      process.env.TRAVELOS_DRIVE_WAREHOUSE_TOKEN = previousToken;
    }
    assert.equal(getDriveWarehouseUrl(), TRAVELOS_DRIVE_WAREHOUSE_URL);
    assert.equal(getDriveWarehouseToken(), TRAVELOS_DRIVE_WAREHOUSE_TOKEN);
  }
});

test("Drive adapter is server-only and Capture still dumps photos in parallel", async () => {
  const [store, blob, photosApi, audioApi, capture, upload, drive, write, tripsContent] = await Promise.all([
    readSource("lib/moment-store.ts"),
    readSource("lib/moment-blob.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/api/moments/audio/route.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("lib/drive-warehouse.ts"),
    readSource("app/trips/write/page.tsx"),
    readSource("app/api/trips/content/route.ts"),
  ]);

  assert.match(drive, /TRAVELOS_DRIVE_WAREHOUSE_URL/);
  assert.match(drive, /export async function getIndex/);
  assert.match(drive, /export async function putIndex/);
  assert.match(drive, /export async function putItem/);
  assert.match(drive, /export async function putBinary/);
  assert.match(drive, /export async function getBinary/);
  assert.match(drive, /options.op/);
  assert.match(drive, /DRIVE_BINARY_CONCURRENCY = 2/);
  assert.match(drive, /withDriveBinarySlot/);
  assert.match(drive, /export async function scanWarehouseFiles/);
  assert.match(drive, /redirect: "manual"/);
  assert.doesNotMatch(drive, /NEXT_PUBLIC/);
  assert.match(store, /shouldUseDriveWarehouse/);
  assert.match(store, /putItem\(/);
  assert.match(store, /putIndex\(/);
  assert.match(store, /putBinary\(/);
  assert.match(store, /resolveMomentPhoto/);
  assert.match(store, /driveStorageKey/);
  assert.doesNotMatch(store, /putWithStoreAccess/);
  assert.doesNotMatch(store, /isBlobConfigured\(\)/);
  assert.match(blob, /parseDriveFileId/);
  assert.match(blob, /getBinary/);
  assert.match(blob, /readMomentThumbBytes/);
  assert.match(blob, /op: "thumb"/);
  assert.match(photosApi, /storeMomentBinary/);
  assert.match(photosApi, /readMomentBlobBytes/);
  assert.match(photosApi, /readMomentThumbBytes/);
  assert.match(audioApi, /storeMomentBinary/);
  assert.match(audioApi, /isTrustedMomentAudioUrl/);
  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(write, /"blob" \| "drive" \| "memory"/);
  assert.match(tripsContent, /readContent/);
  assert.doesNotMatch(tripsContent, /drive-warehouse/);
  assert.doesNotMatch(tripsContent, /moment-store/);

  const clientFiles = (await listFiles(resolve(root, "app"))).concat(await listFiles(resolve(root, "components")));
  for (const file of clientFiles) {
    if (![".ts", ".tsx", ".js", ".mjs"].includes(extname(file))) {
      continue;
    }
    const source = await readFile(file, "utf8");
    if (!source.includes('"use client"') && !source.includes("'use client'")) {
      continue;
    }
    assert.doesNotMatch(source, /drive-warehouse/);
    assert.doesNotMatch(source, /TRAVELOS_DRIVE_WAREHOUSE_TOKEN/);
    assert.doesNotMatch(source, /TRAVELOS_DRIVE_WAREHOUSE_URL/);
    assert.doesNotMatch(source, /cCpNneNyv0_MTyPjAZMkJ3g69t0DfDE-GP84y26YGhU/);
  }
});
