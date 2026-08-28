import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  publicBlobUrl,
  readLiveMomentBlob,
  resolveBlobStoreId,
  shouldFallBackToPublicBlob,
} from "../lib/moment-blob.ts";
import { momentApiErrorResponse } from "../lib/moment-store.ts";
import { WAREHOUSE_GET_OPTIONS } from "../lib/warehouse-read.ts";
import { MOMENT_ITEM_GET_OPTIONS } from "../lib/moment-item.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

test("warehouse JSON reads prefer private origin then unauthenticated public URL", () => {
  assert.equal(WAREHOUSE_GET_OPTIONS.access, "private");
  assert.equal(WAREHOUSE_GET_OPTIONS.useCache, false);
  assert.equal(MOMENT_ITEM_GET_OPTIONS.access, "private");
  assert.equal(MOMENT_ITEM_GET_OPTIONS.useCache, false);
  assert.equal(resolveBlobStoreId({ BLOB_STORE_ID: "store_abc123" }), "abc123");
  assert.equal(resolveBlobStoreId({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_xyz789_secret" }), "xyz789");
  assert.equal(
    publicBlobUrl("travelos/moments.json", "xyz789"),
    "https://xyz789.public.blob.vercel-storage.com/travelos/moments.json",
  );
  assert.equal(shouldFallBackToPublicBlob(new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden")), true);
  assert.equal(shouldFallBackToPublicBlob(new Error("origin down")), false);
});

test("private get 403 falls back to public URL fetch without Authorization", async () => {
  const calls: string[] = [];
  const warehouse = JSON.stringify({ jobs: [], moments: [{ id: "moment_live" }], updatedAt: "2026-08-28T00:00:00.000Z" });

  const loaded = await readLiveMomentBlob("travelos/moments.json", {
    storeId: "xyz789",
    async getBlob(pathname, options) {
      calls.push(`get:${pathname}:${options.access}:${String(options.useCache)}`);
      throw new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden");
    },
    fetchBlob: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push(`fetch:${url}`);
      const headers = new Headers(init?.headers);
      assert.equal(headers.has("authorization"), false);
      assert.equal(url, "https://xyz789.public.blob.vercel-storage.com/travelos/moments.json");
      return new Response(warehouse, { status: 200 });
    }) as typeof fetch,
  });

  assert.ok(loaded);
  assert.equal(loaded.statusCode, 200);
  const body = (await new Response(loaded.stream).json()) as { moments: Array<{ id: string }> };
  assert.equal(body.moments[0]?.id, "moment_live");
  assert.deepEqual(calls, [
    "get:travelos/moments.json:private:false",
    "fetch:https://xyz789.public.blob.vercel-storage.com/travelos/moments.json",
  ]);
});

test("private origin get is used when it returns the warehouse", async () => {
  let fetched = false;
  const loaded = await readLiveMomentBlob("travelos/moments.json", {
    storeId: "xyz789",
    async getBlob() {
      return {
        statusCode: 200,
        stream: new Blob([JSON.stringify({ jobs: [], moments: [{ id: "moment_private" }] })]).stream(),
      };
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

test("missing public warehouse blob is empty, not a 403 crash", async () => {
  const loaded = await readLiveMomentBlob("travelos/moments.json", {
    storeId: "xyz789",
    async getBlob() {
      return null;
    },
    fetchBlob: (async () => new Response("not found", { status: 404 })) as typeof fetch,
  });
  assert.equal(loaded, null);
});

test("blob 403 from POST/GET moment APIs is a 503 with a body", async () => {
  const response = momentApiErrorResponse(new Error("Vercel Blob: Failed to fetch blob: 403 Forbidden"));
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: string };
  assert.match(body.error, /Could not read the moment warehouse/);
  assert.match(body.error, /403 Forbidden/);
});

test("live warehouse reader does not send Authorization to the public CDN", async () => {
  const [blob, store, capture, upload] = await Promise.all([
    readSource("lib/moment-blob.ts"),
    readSource("lib/moment-store.ts"),
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
  ]);

  assert.match(blob, /access: "private", useCache: false/);
  assert.match(blob, /public\.blob\.vercel-storage\.com/);
  assert.match(blob, /cache: "no-store"/);
  assert.doesNotMatch(blob, /authorization:/);
  assert.match(store, /isBlobWarehouseReadError/);
  assert.match(store, /status: 503/);
  assert.match(capture, /void startBackgroundPhotoUpload\(photo\)/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.match(upload, /fetch\("\/api\/moments\/photos"/);
  assert.doesNotMatch(capture, /trip_lapland_2020/);
  assert.doesNotMatch(blob, /trip_lapland_2020/);
});
