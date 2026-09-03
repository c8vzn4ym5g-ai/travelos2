import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  listAndFetchMomentBlob,
  privateBlobUrlFrom,
  publicBlobUrl,
  putWithStoreAccess,
  readLiveMomentBlob,
  resetBlobStoreAccessForTests,
  resolveBlobStoreId,
  shouldFallBackToPublicBlob,
} from "../lib/moment-blob.ts";
import { momentApiErrorResponse } from "../lib/moment-store.ts";
import { loadWarehouseFromBlobGet, WAREHOUSE_GET_OPTIONS } from "../lib/warehouse-read.ts";
import { MOMENT_ITEM_GET_OPTIONS, MOMENT_ITEM_PUT_OPTIONS } from "../lib/moment-item.ts";
import { momentPhotoPlayUrl } from "../lib/moments.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

test("warehouse JSON reads and writes prefer the private store", () => {
  assert.equal(WAREHOUSE_GET_OPTIONS.access, "private");
  assert.equal(WAREHOUSE_GET_OPTIONS.useCache, false);
  assert.equal(MOMENT_ITEM_GET_OPTIONS.access, "private");
  assert.equal(MOMENT_ITEM_PUT_OPTIONS.access, "private");
  assert.equal(resolveBlobStoreId({ BLOB_STORE_ID: "store_abc123" }), "abc123");
  assert.equal(resolveBlobStoreId({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_xyz789_secret" }), "xyz789");
  assert.equal(
    publicBlobUrl("travelos/moments.json", "xyz789"),
    "https://xyz789.public.blob.vercel-storage.com/travelos/moments.json",
  );
  assert.equal(
    privateBlobUrlFrom("https://xyz789.public.blob.vercel-storage.com/travelos/moments.json"),
    "https://xyz789.private.blob.vercel-storage.com/travelos/moments.json",
  );
  assert.equal(shouldFallBackToPublicBlob(new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden")), true);
  assert.equal(shouldFallBackToPublicBlob(new Error("origin down")), false);
  assert.equal(momentPhotoPlayUrl("moment_1", "photo_2"), "/api/moments/photos?momentId=moment_1&photoId=photo_2");
  assert.equal(
    momentPhotoPlayUrl("moment_1", "photo_2", { variant: "thumb" }),
    "/api/moments/photos?momentId=moment_1&photoId=photo_2&variant=thumb",
  );
  assert.equal(
    momentPhotoPlayUrl("moment_1", "photo_2", { fileId: "1abc", variant: "thumb" }),
    "/api/moments/photos?momentId=moment_1&photoId=photo_2&variant=thumb&file=1abc",
  );
});

test("private get 403 rewrites a public head URL onto the private origin", async () => {
  resetBlobStoreAccessForTests();
  const calls: string[] = [];
  const warehouse = JSON.stringify({ jobs: [], moments: [{ id: "moment_live" }], updatedAt: "2026-08-28T00:00:00.000Z" });
  let fetched = false;

  const loaded = await readLiveMomentBlob("travelos/moments.json", {
    storeId: "xyz789",
    async getBlob(pathname, options) {
      calls.push(`get:${pathname}:${options.access}:${String(options.useCache)}`);
      if (pathname.includes(".private.blob.vercel-storage.com")) {
        return { statusCode: 200, stream: new Blob([warehouse]).stream() };
      }
      throw new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden");
    },
    async headBlob(pathname) {
      calls.push(`head:${pathname}`);
      return { url: "https://xyz789.public.blob.vercel-storage.com/travelos/moments.json" };
    },
    fetchBlob: (async () => {
      fetched = true;
      return new Response("blocked", { status: 403 });
    }) as typeof fetch,
  });

  assert.equal(fetched, false);
  assert.ok(loaded);
  const body = (await new Response(loaded.stream).json()) as { moments: Array<{ id: string }> };
  assert.equal(body.moments[0]?.id, "moment_live");
  assert.deepEqual(calls, [
    "get:travelos/moments.json:private:false",
    "get:travelos/moments.json:public:false",
    "head:travelos/moments.json",
    "get:https://xyz789.private.blob.vercel-storage.com/travelos/moments.json:private:false",
  ]);
});

test("authenticated public get is used when the store is still public", async () => {
  resetBlobStoreAccessForTests();
  let fetched = false;
  const loaded = await readLiveMomentBlob("travelos/moments.json", {
    storeId: "xyz789",
    async getBlob(pathname, options) {
      if (options.access === "private") {
        throw new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden");
      }
      return {
        statusCode: 200,
        stream: new Blob([JSON.stringify({ jobs: [], moments: [{ id: "moment_public" }] })]).stream(),
      };
    },
    async headBlob() {
      throw new Error("head should not run");
    },
    fetchBlob: (async () => {
      fetched = true;
      return new Response("blocked", { status: 403 });
    }) as typeof fetch,
  });

  assert.equal(fetched, false);
  const body = (await new Response(loaded?.stream).json()) as { moments: Array<{ id: string }> };
  assert.equal(body.moments[0]?.id, "moment_public");
});

test("private origin get is used when it returns the warehouse", async () => {
  resetBlobStoreAccessForTests();
  let fetched = false;
  const loaded = await readLiveMomentBlob("travelos/moments.json", {
    storeId: "xyz789",
    async getBlob() {
      return {
        statusCode: 200,
        stream: new Blob([JSON.stringify({ jobs: [], moments: [{ id: "moment_private" }] })]).stream(),
      };
    },
    async headBlob() {
      throw new Error("head should not run");
    },
    fetchBlob: (async () => {
      fetched = true;
      return new Response("nope", { status: 500 });
    }) as typeof fetch,
  });

  assert.equal(fetched, false);
  const body = (await new Response(loaded?.stream).json()) as { moments: Array<{ id: string }> };
  assert.equal(body.moments[0]?.id, "moment_private");
});

test("missing warehouse blob is empty, not a 403 crash", async () => {
  resetBlobStoreAccessForTests();
  const loaded = await readLiveMomentBlob("travelos/moments.json", {
    storeId: "xyz789",
    async getBlob() {
      return null;
    },
    async headBlob() {
      return null;
    },
    fetchBlob: (async () => new Response("not found", { status: 404 })) as typeof fetch,
  });
  assert.equal(loaded, null);
});

test("put tries private first and falls back to public when the store is public", async () => {
  resetBlobStoreAccessForTests();
  const tried: string[] = [];
  const saved = await putWithStoreAccess("travelos/moments.json", "{}", { allowOverwrite: true }, async (_pathname, _body, options) => {
    tried.push(options.access);
    if (options.access === "private") {
      throw new Error("Vercel Blob: Access denied, please provide a valid token for this resource.");
    }
    return { pathname: "travelos/moments.json", url: "https://xyz789.public.blob.vercel-storage.com/travelos/moments.json" };
  });
  assert.deepEqual(tried, ["private", "public"]);
  assert.match(saved.url, /\.public\.blob\.vercel-storage\.com/);

  resetBlobStoreAccessForTests();
  const privateSaved = await putWithStoreAccess("travelos/moments.json", "{}", { access: "private" }, async (_pathname, _body, options) => {
    assert.equal(options.access, "private");
    return { pathname: "travelos/moments.json", url: "https://xyz789.private.blob.vercel-storage.com/travelos/moments.json" };
  });
  assert.match(privateSaved.url, /\.private\.blob\.vercel-storage\.com/);

  const remembered: string[] = [];
  await putWithStoreAccess("travelos/moments.json", "{}", { allowOverwrite: true }, async (_pathname, _body, options) => {
    remembered.push(options.access);
    return { pathname: "travelos/moments.json", url: "https://xyz789.private.blob.vercel-storage.com/travelos/moments.json" };
  });
  assert.deepEqual(remembered, ["private"]);
});

test("blob 403 from POST/GET moment APIs is a 503 with a body", async () => {
  const response = momentApiErrorResponse(new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden"));
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /Could not read the moment warehouse/);
  assert.match(body.error, /403 Forbidden/);

  const accessDenied = momentApiErrorResponse(new Error("Access denied, please provide a valid token for this resource."));
  assert.equal(accessDenied.status, 503);
  const accessBody = (await accessDenied.json()) as { error: string };
  assert.match(accessBody.error, /Access denied/);
});

test("list+fetch 403 is an empty warehouse, not a 503", async () => {
  const listed = await listAndFetchMomentBlob("travelos/moments.json", {
    async listBlobs(query) {
      assert.equal(query.prefix, "travelos/moments.json");
      return {
        blobs: [{ pathname: "travelos/moments.json", url: "https://cdn.example/travelos/moments.json" }],
      };
    },
    fetchBlob: (async (input) => {
      assert.equal(String(input), "https://cdn.example/travelos/moments.json");
      return new Response("blocked", { status: 403, statusText: "Forbidden" });
    }) as typeof fetch,
  });
  assert.equal(listed?.statusCode, 403);
  assert.equal(listed?.stream, null);

  const loaded = await loadWarehouseFromBlobGet(async () => listed);
  assert.equal(loaded.createdEmpty, false);
  assert.deepEqual(loaded.content.moments, []);
  assert.deepEqual(loaded.content.jobs, []);
});

test("live warehouse reader lists then fetches, keeps parallel Capture POSTs, and family photo proxy", async () => {
  const [blob, store, capture, upload, photosApi, bench, benchPhoto, write, transcript] = await Promise.all([
    readSource("lib/moment-blob.ts"),
    readSource("lib/moment-store.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/photos/route.ts"),
    readSource("app/family/bench/page.tsx"),
    readSource("app/family/bench/bench-photo.tsx"),
    readSource("app/trips/write/page.tsx"),
    readSource("lib/moment-transcript.ts"),
  ]);

  assert.match(blob, /listAndFetchMomentBlob/);
  assert.match(blob, /list\(\{/);
  assert.match(blob, /return await listAndFetchMomentBlob\(pathname\)/);
  assert.match(blob, /access: "private", useCache: false/);
  assert.match(blob, /\.private\.blob\.vercel-storage\.com/);
  assert.match(blob, /putWithStoreAccess/);
  assert.doesNotMatch(blob, /authorization:/);
  assert.match(store, /listMomentBlobs/);
  assert.match(store, /momentsFromListedItemBlobs/);
  assert.match(store, /putBinary/);
  assert.match(store, /putVideoBinary/);
  assert.match(store, /access: "private"/);
  assert.doesNotMatch(store, /import \{[^}]*\blist\b/);
  assert.doesNotMatch(store, /list\(/);
  assert.match(photosApi, /export async function GET/);
  assert.match(photosApi, /readMomentBlobBytes/);
  assert.match(photosApi, /readMomentThumbBytes/);
  assert.match(photosApi, /resolveMomentPhoto/);
  assert.match(photosApi, /photoFromDriveFileId/);
  assert.match(photosApi, /reason: "missing-photo"/);
  assert.match(photosApi, /reason: "binary-miss"/);
  assert.match(bench, /BenchPhotoThumb/);
  assert.match(benchPhoto, /variant: "thumb"/);
  assert.match(benchPhoto, /fileId/);
  assert.match(write, /momentPhotoPlayUrl/);
  assert.match(transcript, /readMomentBlobBytes/);
  assert.match(capture, /void startBackgroundPhotoUpload\(photo\)/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.match(upload, /fetch\("\/api\/moments\/photos"/);
  assert.doesNotMatch(capture, /trip_lapland_2020/);
  assert.doesNotMatch(blob, /trip_lapland_2020/);
  assert.match(store, /putBinary/);
  assert.match(store, /driveStorageKey/);
  assert.doesNotMatch(store, /putWithStoreAccess/);
  assert.doesNotMatch(store, /isBlobConfigured\(\)/);
});
