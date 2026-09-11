import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { isTripPhotoVideo, tripMediaContentType } from "../lib/trip-photo.ts";
import { resetDriveWarehouseForTests, setDriveWarehouseFetchForTests } from "../lib/drive-warehouse.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

function jsonResponse(value: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
}

test("trip photos treat mp4/mov/m4v and video mime as video, jpg as photo", () => {
  assert.equal(isTripPhotoVideo({ originalFilename: "clip.mp4" }), true);
  assert.equal(isTripPhotoVideo({ originalFilename: "CLIP.MOV" }), true);
  assert.equal(isTripPhotoVideo({ originalFilename: "promo.m4v" }), true);
  assert.equal(isTripPhotoVideo({ mimeType: "video/mp4", originalFilename: "file.bin" }), true);
  assert.equal(isTripPhotoVideo({ originalFilename: "cover.jpg" }), false);
  assert.equal(isTripPhotoVideo({ originalFilename: "still.JPEG" }), false);
  assert.equal(isTripPhotoVideo({ mimeType: "image/jpeg", originalFilename: "photo.jpg" }), false);
});

test("trip media content-type keeps Drive image types and infers video from filename", () => {
  assert.equal(tripMediaContentType({ driveContentType: "image/jpeg" }), "image/jpeg");
  assert.equal(tripMediaContentType({ driveContentType: "video/mp4" }), "video/mp4");
  assert.equal(
    tripMediaContentType({ driveContentType: "application/octet-stream", filename: "clip.mp4" }),
    "video/mp4",
  );
  assert.equal(
    tripMediaContentType({ driveContentType: "application/octet-stream", filename: "IMG_1504.MOV" }),
    "video/quicktime",
  );
  assert.equal(
    tripMediaContentType({ driveContentType: "application/octet-stream", mimeType: "video/mp4" }),
    "video/mp4",
  );
});

test("trips admin photo grid plays video photos with controls and keeps img for stills", async () => {
  const admin = await readSource("app/trips/admin/page.tsx");
  assert.match(admin, /isTripPhotoVideo\(photo\)/);
  assert.match(admin, /<video[\s\S]*controls[\s\S]*playsInline[\s\S]*preload="metadata"/);
  assert.match(admin, /src=\{photo\.storageKey\}/);
  assert.match(admin, /<img alt=\{photo\.caption \?\? photo\.originalFilename\} className=\{`\$\{className\} w-full object-cover`\} src=\{photo\.storageKey\} \/>/);
  assert.match(admin, /`Video \$\{index \+ 1\}`/);
  assert.doesNotMatch(admin, /accept="image\/\*,video\/\*"/);
});

test("trips media streams Drive bytes and does not force image/jpeg for mp4", async () => {
  const bytes = Uint8Array.from([0, 0, 0, 1, 0x67, 0x42]);
  const originalFetch = globalThis.fetch;
  setDriveWarehouseFetchForTests(async (input) => {
    const parsed = new URL(String(input));
    if (parsed.searchParams.get("op") === "drive-access") {
      return jsonResponse({ folderId: "folder_test", token: "ya29.trip-media" });
    }
    throw new Error(`unexpected warehouse ${parsed.href}`);
  });
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.includes("alt=media")) {
      return new Response(bytes, {
        headers: { "content-length": String(bytes.byteLength), "content-type": "application/octet-stream" },
        status: 200,
      });
    }
    if (url.includes("/drive/v3/files/") && url.includes("fields=name,mimeType")) {
      return jsonResponse({ mimeType: "application/octet-stream", name: "promote-short.mp4" });
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  try {
    const { GET } = await import("../app/api/trips/media/route.ts");
    const response = await GET(new Request("http://travelos.local/api/trips/media?id=driveFileMp4"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "video/mp4");
    assert.notEqual(response.headers.get("content-type"), "image/jpeg");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  } finally {
    globalThis.fetch = originalFetch;
    setDriveWarehouseFetchForTests(null);
    resetDriveWarehouseForTests();
  }
});

test("trips media keeps jpeg content-type when Drive already sends image/jpeg", async () => {
  const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const originalFetch = globalThis.fetch;
  let metaCalls = 0;
  setDriveWarehouseFetchForTests(async (input) => {
    const parsed = new URL(String(input));
    if (parsed.searchParams.get("op") === "drive-access") {
      return jsonResponse({ folderId: "folder_test", token: "ya29.trip-media" });
    }
    throw new Error(`unexpected warehouse ${parsed.href}`);
  });
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url.includes("alt=media")) {
      return new Response(bytes, {
        headers: { "content-length": String(bytes.byteLength), "content-type": "image/jpeg" },
        status: 200,
      });
    }
    if (url.includes("fields=name,mimeType")) {
      metaCalls += 1;
      return jsonResponse({ mimeType: "image/jpeg", name: "cover.jpg" });
    }
    return originalFetch(input as RequestInfo, init);
  }) as typeof fetch;

  try {
    const { GET } = await import("../app/api/trips/media/route.ts");
    const response = await GET(new Request("http://travelos.local/api/trips/media?id=driveFileJpg"));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/jpeg");
    assert.equal(metaCalls, 0);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  } finally {
    globalThis.fetch = originalFetch;
    setDriveWarehouseFetchForTests(null);
    resetDriveWarehouseForTests();
  }
});
