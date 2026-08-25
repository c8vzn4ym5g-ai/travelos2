import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  CAPTURE_UPLOAD_CONCURRENCY,
  captureBatchMessage,
  createStagedCapturePhotos,
  createTinyPreviewUrl,
  createWorkQueue,
  snapshotFileList,
  uploadDisplayPhoto,
} from "../lib/capture-upload.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

function fakeFileList(files: File[]): FileList {
  const list: Record<string, unknown> = {
    length: files.length,
    item(index: number) {
      return files[index] ?? null;
    },
    *[Symbol.iterator]() {
      yield* files;
    },
  };
  files.forEach((file, index) => {
    list[index] = file;
  });
  return list as unknown as FileList;
}

function albumFiles(count: number, type = "image/heic") {
  const extension = type.includes("heic") ? "HEIC" : "JPG";
  return Array.from(
    { length: count },
    (_, index) =>
      new File([new Uint8Array([index, 1, 2, 3])], `IMG_${String(index).padStart(4, "0")}.${extension}`, { type }),
  );
}

test("work queue keeps concurrency at 3 for a 100-photo dump", async () => {
  assert.equal(CAPTURE_UPLOAD_CONCURRENCY, 3);
  const queue = createWorkQueue();
  let active = 0;
  let maxActive = 0;
  let started = 0;

  const jobs = Array.from({ length: 100 }, (_, index) =>
    queue.enqueue(async () => {
      started += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return index;
    }),
  );

  await Promise.resolve();
  assert.ok(started <= CAPTURE_UPLOAD_CONCURRENCY);
  assert.equal(queue.activeCount, CAPTURE_UPLOAD_CONCURRENCY);
  assert.equal(queue.pendingCount, 100 - CAPTURE_UPLOAD_CONCURRENCY);

  const results = await Promise.all(jobs);
  assert.equal(results.length, 100);
  assert.deepEqual(results, Array.from({ length: 100 }, (_, index) => index));
  assert.equal(maxActive, CAPTURE_UPLOAD_CONCURRENCY);
  assert.equal(queue.activeCount, 0);
  assert.equal(queue.pendingCount, 0);
});

test("queued aborted work is skipped without blocking later photos", async () => {
  const queue = createWorkQueue(1);
  const abort = new AbortController();
  const ran: string[] = [];

  abort.abort();
  const skipped = queue.enqueue(async () => {
    if (abort.signal.aborted) {
      return "skipped";
    }
    ran.push("should-not-run");
    return "ran";
  });
  const later = queue.enqueue(async () => {
    ran.push("later");
    return "later";
  });

  assert.equal(await skipped, "skipped");
  assert.equal(await later, "later");
  assert.deepEqual(ran, ["later"]);
});

test("staging a large iPhone album does not create object URLs", async () => {
  const original = URL.createObjectURL;
  let created = 0;
  URL.createObjectURL = ((blob: Blob) => {
    created += 1;
    return typeof original === "function" ? original.call(URL, blob) : `blob:test:${created}`;
  }) as typeof URL.createObjectURL;

  try {
    const files = albumFiles(120);
    const list = fakeFileList(files);
    const snapshotted = snapshotFileList(list);
    assert.equal(snapshotted.length, 120);
    assert.equal(snapshotted[0], files[0]);
    assert.equal(snapshotted[119], files[119]);

    const staged = createStagedCapturePhotos(snapshotted);
    assert.equal(staged.length, 120);
    assert.equal(created, 0);
    assert.equal(
      staged.every((photo) => photo.previewUrl === null && photo.status === "queued"),
      true,
    );
    assert.equal(await createTinyPreviewUrl(files[0]!), null);
  } finally {
    if (typeof original === "function") {
      URL.createObjectURL = original;
    } else {
      Reflect.deleteProperty(URL, "createObjectURL");
    }
  }
});

test("batch message reports how many were received", () => {
  assert.match(captureBatchMessage(100, 100), /已收到 100 張，分批上傳中/);
  assert.match(captureBatchMessage(100, 141), /目前共 141 張，會繼續傳到倉庫/);
  assert.match(captureBatchMessage(0, 0), /請選照片/);
});

test("display-ready hook runs before the photo POST", async () => {
  const events: string[] = [];
  const jpeg = new File([new Uint8Array([1, 2, 3, 4])], "park.jpg", { type: "image/jpeg" });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    events.push("post");
    return Response.json({ photo: { id: "moment_photo_ready", momentId: "moment_ready" } });
  }) as typeof fetch;

  try {
    const uploaded = await uploadDisplayPhoto({
      coordinates: null,
      file: jpeg,
      momentId: "moment_ready",
      onDisplayReady: async (display) => {
        events.push("ready");
        assert.ok(display);
      },
      pin: "test-capture-pin",
      takenAt: "2026-08-25T05:55:25.000Z",
    });
    assert.equal(uploaded.photo.id, "moment_photo_ready");
    assert.deepEqual(events, ["ready", "post"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("capture page queues prepares instead of exploding a FileList", async () => {
  const [capture, upload, prepare] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("lib/prepare-photo.ts"),
  ]);

  const addBlock = capture.slice(
    capture.indexOf("function addIncomingFiles"),
    capture.indexOf("function onTakePhoto"),
  );
  const uploadFn = capture.slice(
    capture.indexOf("async function startBackgroundPhotoUpload"),
    capture.indexOf("async function startBackgroundAudioUpload"),
  );

  assert.match(upload, /CAPTURE_UPLOAD_CONCURRENCY = 3/);
  assert.match(capture, /createWorkQueue\(CAPTURE_UPLOAD_CONCURRENCY\)/);
  assert.match(capture, /photoQueueRef\.current\.enqueue/);
  assert.match(addBlock, /snapshotFileList\(fileList\)/);
  assert.match(addBlock, /createStagedCapturePhotos\(files\)/);
  assert.match(addBlock, /captureBatchMessage\(incoming\.length, next\.length\)/);
  assert.doesNotMatch(addBlock, /URL\.createObjectURL/);
  assert.doesNotMatch(addBlock, /makeStagedPhotos/);
  assert.match(uploadFn, /onDisplayReady/);
  assert.match(uploadFn, /createTinyPreviewUrl\(display\)/);
  assert.match(capture, /排隊中/);
  assert.match(prepare, /resizeHeight: 240/);
  assert.match(prepare, /isHeicPhoto\(file\)/);
  assert.doesNotMatch(capture, /from "@\/lib\/trips"/);
  assert.doesNotMatch(capture, /travelpayouts/i);
  assert.doesNotMatch(upload, /travelpayouts/i);
});
