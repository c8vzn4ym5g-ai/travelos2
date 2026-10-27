import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import { createHash } from "node:crypto";
import test from "node:test";
import { uploadDisplayPhoto } from "../lib/capture-upload.ts";

// Execute the production POST handler with only storage/metadata boundaries replaced.
// No Drive access or family records are used by this failure simulation.
async function photoServer(options: { failFirstPersist?: boolean } = {}) {
  const source = await readFile(new URL("../app/api/moments/photos/route.ts", import.meta.url), "utf8");
  const js = stripTypeScriptTypes(source.replace(/^import[\s\S]*?from\s+"[^"]+";\s*/gm, ""))
    .replace(/export /g, "");
  const photos = new Map<string, any>();
  let writes = 0;
  let ids = 0;
  let persists = 0;
  const pending: Array<Promise<unknown>> = [];
  const dependencies = {
    createHash,
    afterResponse: (work: () => Promise<unknown>) => {
      pending.push(Promise.resolve().then(work).catch(() => undefined));
    },
    isAdminPinValid: () => true,
    isUploadBlob: (file: unknown) => file instanceof Blob,
    uploadFilename: (file: File) => file.name,
    getMomentById: async () => {
      throw new Error("display POST must not await getMomentById");
    },
    peekUploadedDisplayPhoto: (_id: string, photoId: string) => photos.get(photoId) ?? null,
    readOriginalCaptureMetadata: async () => ({}),
    captureMetadataPhotoFields: () => ({}),
    photoUploadMetadata: () => ({}),
    storeMomentBinary: async () => ({ url: `blob-${++writes}` }),
    makeMomentId: () => `generated-${++ids}`,
    momentMediaKindFromFile: () => "image",
    rememberUploadedDisplayPhoto: (_id: string, photo: any) => { photos.set(photo.id, photo); },
    addPhotoToMoment: async (_id: string, photo: any) => {
      if (++persists === 1 && options.failFirstPersist) throw new Error("storage unavailable");
      photos.set(photo.id, { ...photos.get(photo.id), ...photo });
      return { moments: [{ photos: [...photos.values()] }] };
    },
    momentApiErrorResponse: (error: Error) => Response.json({ error: error.message }, { status: 503 }),
  };
  const POST = new Function(...Object.keys(dependencies), `${js}; return POST;`)(...Object.values(dependencies));
  return {
    POST,
    photos,
    writes: () => writes,
    persists: () => persists,
    flush: async () => { await Promise.all(pending.splice(0)); },
  };
}

test("retry persists a cached photo again when its first metadata write failed", async () => {
  const server = await photoServer({ failFirstPersist: true });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url, init) => server.POST(new Request("http://travelos.local/api/moments/photos", init));
  try {
    await uploadDisplayPhoto({
      uploadId: "cached-photo", coordinates: null, file: new File(["jpeg"], "a.jpg", { type: "image/jpeg" }),
      momentId: "moment-one", pin: "", takenAt: "2026-09-13T00:00:00Z",
    });
    await server.flush();
    assert.equal(server.photos.size, 1);
    assert.equal(server.writes(), 1);
    assert.equal(server.persists(), 1, "first afterResponse persist failed");

    await uploadDisplayPhoto({
      uploadId: "cached-photo", coordinates: null, file: new File(["jpeg"], "a.jpg", { type: "image/jpeg" }),
      momentId: "moment-one", pin: "", takenAt: "2026-09-13T00:00:00Z",
    });
    await server.flush();
    assert.equal(server.writes(), 1, "idempotent retry must not store another display binary");
    assert.equal(server.persists(), 2, "idempotent retry repairs metadata via afterResponse");
  } finally { globalThis.fetch = originalFetch; }
});

for (const fault of ["lost acknowledgement", "HTTP 503"] as const) {
  test(`display retry after ${fault} keeps one photo and its preserved original`, async () => {
    const server = await photoServer();
    const originalFetch = globalThis.fetch;
    const uploadIds: unknown[] = [];
    let attempts = 0;
    globalThis.fetch = async (_url, init) => {
      uploadIds.push((init!.body as FormData).get("uploadId"));
      const response = await server.POST(new Request("http://travelos.local/api/moments/photos", init));
      if (++attempts === 1) {
        for (const photo of server.photos.values()) {
          Object.assign(photo, { originalStorageKey: "original-kept", caption: "family caption", takenAt: "2020-01-01T00:00:00Z" });
        }
        if (fault === "lost acknowledgement") throw new TypeError("Failed to fetch");
        return Response.json({ error: "temporary" }, { status: 503 });
      }
      return response;
    };
    try {
      const input = {
        uploadId: "staged-photo-one", coordinates: null, file: new File(["jpeg"], "same.jpg", { type: "image/jpeg" }),
        momentId: "moment-one", pin: "", takenAt: "2026-09-13T00:00:00Z",
      };
      const result = await uploadDisplayPhoto(input);
      await server.flush();
      assert.equal(attempts, 2);
      assert.equal(server.photos.size, 1);
      assert.deepEqual(uploadIds, ["staged-photo-one", "staged-photo-one"]);
      assert.equal(server.writes(), 1);
      assert.equal(result.photo.originalStorageKey, "original-kept");
      assert.equal(result.photo.caption, "family caption");
      assert.equal(result.photo.takenAt, "2020-01-01T00:00:00Z");
      const manualRetry = await uploadDisplayPhoto(input);
      await server.flush();
      assert.equal(manualRetry.photo.id, result.photo.id);
      assert.equal(server.photos.size, 1);
      assert.equal(server.writes(), 1);
      const separate = await uploadDisplayPhoto({ ...input, uploadId: "staged-photo-two" });
      await server.flush();
      assert.notEqual(separate.photo.id, result.photo.id);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("Capture uses the persisted staged identity for display uploads", async () => {
  const source = await readFile(new URL("../app/family/capture/page.tsx", import.meta.url), "utf8");
  assert.match(source, /await uploadDisplayPhoto\(\{\s*uploadId: photo\.id,/);
});

test("Capture never re-queues display POST once serverPhotoId is known", async () => {
  const source = await readFile(new URL("../app/family/capture/page.tsx", import.meta.url), "utf8");
  const start = source.slice(
    source.indexOf("async function startBackgroundPhotoUpload"),
    source.indexOf("async function runBackgroundPhotoUpload"),
  );
  assert.match(start, /latest\.status === "uploaded" \|\| latest\.serverPhotoId/);
  assert.match(source, /createDisplayGatedOriginalUploader/);
});
