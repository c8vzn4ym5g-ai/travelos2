import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import test from "node:test";
import {
  DRIVE_WAREHOUSE_FOLDER_ID,
  TRAVELOS_DRIVE_WAREHOUSE_TOKEN,
  TRAVELOS_DRIVE_WAREHOUSE_URL,
  driveObjectName,
  driveStorageKey,
  getBinary,
  getDriveAccess,
  getDriveMedia,
  getDriveWarehouseToken,
  getDriveWarehouseUrl,
  getIndex,
  parseDriveFileId,
  putBinary,
  putIndex,
  putItem,
  putVideoBinary,
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

test("putVideoBinary sends raw bytes on Drive resumable, not Apps Script JSON+base64", async () => {
  const movie = new Uint8Array(64).fill(9);
  const calls: Array<{ bodyKind: string; method: string; url: string }> = [];
  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body;
    const bodyKind =
      body instanceof Uint8Array
        ? "bytes"
        : typeof body === "string" && body.includes("base64")
          ? "json-base64"
          : typeof body === "string"
            ? "json"
            : body == null
              ? "empty"
              : "other";
    calls.push({ bodyKind, method, url });

    if (method === "GET" && url.includes("op=drive-access")) {
      return jsonResponse({ folderId: DRIVE_WAREHOUSE_FOLDER_ID, token: "ya29.fake-drive-token" });
    }
    if (method === "POST" && url.includes("uploadType=resumable")) {
      assert.equal((init?.headers as Record<string, string>)?.Authorization, "Bearer ya29.fake-drive-token");
      assert.doesNotMatch(typeof body === "string" ? body : "", /base64/);
      return new Response(null, {
        headers: { location: "https://www.googleapis.com/upload/drive/v3/files?upload_id=mov15s" },
        status: 200,
      });
    }
    if (method === "PUT" && url.includes("upload_id=mov15s")) {
      assert.ok(body instanceof Uint8Array);
      assert.deepEqual([...body], [...movie]);
      return jsonResponse({ id: "file_mov_15s", name: "IMG_1504.MOV" });
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;

  const stored = await putVideoBinary(
    { bytes: movie, mimeType: "video/quicktime", name: "IMG_1504.MOV" },
    fakeFetch,
  );
  assert.equal(stored.id, "file_mov_15s");
  assert.equal(
    calls.some((call) => call.url.includes("script.google.com") && call.method === "GET"),
    true,
  );
  assert.equal(
    calls.some((call) => call.url.includes("uploadType=resumable") && call.method === "POST"),
    true,
  );
  assert.equal(
    calls.some((call) => call.bodyKind === "bytes" && call.method === "PUT"),
    true,
  );
  assert.equal(
    calls.some((call) => call.bodyKind === "json-base64"),
    false,
  );

  const access = await getDriveAccess(fakeFetch);
  assert.equal(access?.token, "ya29.fake-drive-token");
  assert.equal(access?.folderId, DRIVE_WAREHOUSE_FOLDER_ID);

  const mediaFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    if (url.includes("op=drive-access")) {
      return jsonResponse({ folderId: DRIVE_WAREHOUSE_FOLDER_ID, token: "ya29.fake-drive-token" });
    }
    if (url.includes("alt=media")) {
      assert.match(url, /file_mov_15s/);
      return new Response(movie, { headers: { "content-type": "video/quicktime" } });
    }
    throw new Error(`unexpected media fetch ${url}`);
  }) as typeof fetch;
  const media = await getDriveMedia("file_mov_15s", mediaFetch);
  assert.deepEqual([...(media?.bytes ?? [])], [...movie]);
  assert.equal(media?.mimeType, "video/quicktime");
});

test("putVideoBinary falls back to JSON+base64 when Apps Script has no drive-access yet", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const fakeFetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET") {
      return jsonResponse({ error: "missing id" });
    }
    const payload = JSON.parse(typeof init?.body === "string" ? init.body : "{}") as {
      base64?: string;
      name?: string;
    };
    assert.ok(payload.base64);
    assert.equal(payload.name, "tiny.MOV");
    return jsonResponse({ id: "file_tiny_mov", name: payload.name });
  }) as typeof fetch;

  const stored = await putVideoBinary({ bytes, mimeType: "video/quicktime", name: "tiny.MOV" }, fakeFetch);
  assert.equal(stored.id, "file_tiny_mov");
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

function extractNamedFunction(source: string, name: string) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error(`unclosed ${name}`);
}

function stripWithLockCalls(source: string) {
  const marker = "withLock_(";
  let out = source;
  let idx = out.indexOf(marker);
  while (idx >= 0) {
    let depth = 1;
    let end = idx + marker.length;
    for (let i = end; i < out.length; i += 1) {
      if (out[i] === "(") {
        depth += 1;
      } else if (out[i] === ")") {
        depth -= 1;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
    if (out[end] === ";") {
      end += 1;
    }
    out = `${out.slice(0, idx)}/*locked*/${out.slice(end)}`;
    idx = out.indexOf(marker);
  }
  return out;
}

test("Apps Script locks only index/item writes so photo binaries stay parallel", async () => {
  const script = await readSource("scripts/drive-warehouse-apps-script.js");
  const doPost = extractNamedFunction(script, "doPost");
  const withLock = extractNamedFunction(script, "withLock_");
  const createBinary = extractNamedFunction(script, "createBinaryFile_");
  const writeIndex = extractNamedFunction(script, "writeIndex_");
  const writeItem = extractNamedFunction(script, "writeItem_");

  assert.match(withLock, /LockService\.getScriptLock/);
  assert.match(withLock, /waitLock\(30000\)/);
  assert.match(writeIndex, /mergeMomentLists_/);
  assert.match(writeItem, /mergeMoment_/);
  assert.match(createBinary, /base64Decode\(body\.base64\)/);
  assert.match(createBinary, /folder_\(\)\.createFile/);
  assert.doesNotMatch(createBinary, /LockService|waitLock|withLock_/);

  assert.match(doPost, /if \(body\.op === "index"\) \{\s*return withLock_/);
  assert.match(doPost, /if \(body\.op === "item"\) \{\s*return withLock_/);
  assert.equal((doPost.match(/withLock_\(/g) ?? []).length, 2);
  assert.match(doPost, /return createBinaryFile_\(body\)/);
  assert.doesNotMatch(doPost, /var body = JSON\.parse\(e\.postData\.contents\);\s*return withLock_/);

  const doGet = extractNamedFunction(script, "doGet");
  assert.match(doGet, /op === "drive-access"/);
  assert.match(doGet, /ScriptApp\.getOAuthToken/);
  assert.match(doGet, /folderId: FOLDER_ID/);
  assert.ok(doGet.indexOf('op === "drive-access"') < doGet.indexOf('error: "missing id"'));

  const unlocked = stripWithLockCalls(doPost);
  assert.match(unlocked, /createBinaryFile_\(body\)/);
  assert.doesNotMatch(unlocked, /writeIndex_|writeItem_/);
  assert.doesNotMatch(unlocked, /LockService/);

  const lockWaits: number[] = [];
  const created: string[] = [];
  let lockHeld = false;
  const emptyIter = () => ({ hasNext: () => false, next: () => null });
  const apps = {
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput(text: string) {
        return { setMimeType() { return text; } };
      },
    },
    DriveApp: {
      getFolderById() {
        return {
          getFiles: emptyIter,
          getFilesByName: emptyIter,
          createFile(blob: { name: string }) {
            created.push(blob.name);
            return { getId: () => `file_${created.length}`, getName: () => blob.name };
          },
        };
      },
    },
    LockService: {
      getScriptLock() {
        return {
          waitLock(ms: number) {
            lockWaits.push(ms);
            if (lockHeld) {
              throw new Error(`Could not obtain lock after ${ms}ms.`);
            }
            lockHeld = true;
          },
          releaseLock() {
            lockHeld = false;
          },
        };
      },
    },
    Utilities: {
      base64Decode() {
        return [1, 2, 3];
      },
      newBlob(_contents: unknown, _mimeType: string, name: string) {
        return { name };
      },
    },
  };
  const loaded = new Function(
    "ContentService",
    "DriveApp",
    "LockService",
    "Utilities",
    `${script}\nreturn { doPost, TOKEN };`,
  )(apps.ContentService, apps.DriveApp, apps.LockService, apps.Utilities) as {
    TOKEN: string;
    doPost: (e: { parameter: { token: string }; postData: { contents: string } }) => string;
  };

  lockHeld = true;
  for (let i = 0; i < 40; i += 1) {
    const result = JSON.parse(
      loaded.doPost({
        parameter: { token: loaded.TOKEN },
        postData: {
          contents: JSON.stringify({
            base64: "AQID",
            mimeType: "image/jpeg",
            name: `travelos__moments__photos__moment_dump__${i}.jpg`,
          }),
        },
      }),
    ) as { id?: string; name?: string };
    assert.equal(result.name, `travelos__moments__photos__moment_dump__${i}.jpg`);
    assert.ok(result.id);
  }
  assert.equal(created.length, 40);
  assert.equal(lockWaits.length, 0);

  lockHeld = false;
  const indexResult = JSON.parse(
    loaded.doPost({
      parameter: { token: loaded.TOKEN },
      postData: {
        contents: JSON.stringify({ op: "index", text: JSON.stringify({ jobs: [], moments: [] }) }),
      },
    }),
  ) as { name?: string; ok?: boolean };
  assert.equal(indexResult.ok, true);
  assert.equal(indexResult.name, "moments.json");
  assert.equal(lockWaits.length, 1);

  const itemResult = JSON.parse(
    loaded.doPost({
      parameter: { token: loaded.TOKEN },
      postData: {
        contents: JSON.stringify({
          name: "travelos__moments__items__moment_dump.json",
          op: "item",
          text: JSON.stringify({ moment: { id: "moment_dump", photos: [] } }),
        }),
      },
    }),
  ) as { name?: string; ok?: boolean };
  assert.equal(itemResult.ok, true);
  assert.equal(lockWaits.length, 2);

  lockHeld = true;
  assert.throws(
    () =>
      loaded.doPost({
        parameter: { token: loaded.TOKEN },
        postData: {
          contents: JSON.stringify({ op: "index", text: JSON.stringify({ jobs: [], moments: [] }) }),
        },
      }),
    /Could not obtain lock after 30000ms/,
  );
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
  assert.match(drive, /export async function putVideoBinary/);
  assert.match(drive, /export async function getDriveAccess/);
  assert.match(drive, /export async function getDriveMedia/);
  assert.match(drive, /uploadType=resumable/);
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
  assert.match(store, /putVideoBinary\(/);
  assert.match(store, /isCaptureVideoFile/);
  assert.match(store, /resolveMomentPhoto/);
  assert.match(store, /driveStorageKey/);
  assert.doesNotMatch(store, /putWithStoreAccess/);
  assert.doesNotMatch(store, /isBlobConfigured\(\)/);
  assert.match(blob, /parseDriveFileId/);
  assert.match(blob, /getDriveMedia/);
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
