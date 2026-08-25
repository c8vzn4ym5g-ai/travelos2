import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  CAPTURE_UPLOAD_CONCURRENCY,
  captureBatchMessage,
  capturePrepareConcurrency,
  copyCaptureFile,
  createStagedCapturePhotos,
  createTinyPreviewUrl,
  createWorkQueue,
  ingestCaptureFileList,
  snapshotFileList,
  uploadDisplayPhoto,
} from "../lib/capture-upload.ts";

const root = resolve(import.meta.dirname, "..");
const iphoneSafari =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ipadSafari =
  "Mozilla/5.0 (iPad; CPU OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1";
const ipadOsDesktopUa =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15";
const desktopChrome =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

test("iOS path uses concurrency 1 for prepare", async () => {
  assert.equal(CAPTURE_UPLOAD_CONCURRENCY, 3);
  assert.equal(capturePrepareConcurrency({ userAgent: iphoneSafari }), 1);
  assert.equal(capturePrepareConcurrency({ userAgent: ipadSafari }), 1);
  assert.equal(capturePrepareConcurrency({ maxTouchPoints: 5, userAgent: ipadOsDesktopUa }), 1);
  assert.equal(capturePrepareConcurrency({ hasHeic: true, userAgent: desktopChrome }), 1);
  assert.equal(capturePrepareConcurrency({ userAgent: desktopChrome }), CAPTURE_UPLOAD_CONCURRENCY);

  const queue = createWorkQueue(capturePrepareConcurrency({ userAgent: iphoneSafari }));
  let active = 0;
  let maxActive = 0;
  const jobs = Array.from({ length: 8 }, (_, index) =>
    queue.enqueue(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return index;
    }),
  );

  await Promise.resolve();
  assert.equal(queue.activeCount, 1);
  await Promise.all(jobs);
  assert.equal(maxActive, 1);
  assert.equal(queue.activeCount, 0);
});

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

test("large FileList is copied without clearing the input first", async () => {
  const files = albumFiles(100);
  const list = fakeFileList(files);
  const input = { value: "C:\\fakepath\\album" };
  const clearedDuringCopy: boolean[] = [];
  let reset = false;

  const result = await ingestCaptureFileList(list, {
    copyFile(file) {
      clearedDuringCopy.push(reset);
      assert.equal(input.value, "C:\\fakepath\\album");
      const copied = copyCaptureFile(file);
      assert.notEqual(copied, file);
      assert.equal(copied.name, file.name);
      return copied;
    },
    onCopied() {},
    resetInput() {
      reset = true;
      input.value = "";
    },
    yieldTurn: async () => {},
  });

  assert.equal(result.copied.length, 100);
  assert.equal(clearedDuringCopy.length, 100);
  assert.equal(clearedDuringCopy.every((wasReset) => wasReset === false), true);
  assert.equal(reset, true);
  assert.equal(input.value, "");
});

test("first upload may start before the rest of the album is staged", async () => {
  const events: string[] = [];
  const files = albumFiles(100);

  await ingestCaptureFileList(fakeFileList(files), {
    copyFile(file) {
      events.push(`copy:${file.name}`);
      return copyCaptureFile(file);
    },
    onCopied(file, { copiedCount }) {
      events.push(`stage:${copiedCount}`);
      if (copiedCount === 1) {
        events.push(`upload-first:${file.name}`);
      }
    },
    resetInput() {
      events.push("reset");
    },
    yieldTurn: async () => {
      events.push("yield");
    },
  });

  const firstCopy = events.indexOf("copy:IMG_0000.HEIC");
  const firstUpload = events.indexOf("upload-first:IMG_0000.HEIC");
  const lastCopy = events.indexOf("copy:IMG_0099.HEIC");
  const lastStage = events.indexOf("stage:100");
  const resetAt = events.indexOf("reset");

  assert.ok(firstCopy !== -1 && firstUpload !== -1 && lastCopy !== -1);
  assert.ok(firstUpload > firstCopy);
  assert.ok(firstUpload < lastCopy);
  assert.ok(firstUpload < lastStage);
  assert.ok(resetAt > lastCopy);
  assert.ok(resetAt > lastStage);
  assert.equal(events.at(-1), "reset");
});

test("input may be reset only after copies exist", async () => {
  const events: string[] = [];
  const files = albumFiles(12);

  await ingestCaptureFileList(fakeFileList(files), {
    copyFile(file) {
      events.push("copy");
      return copyCaptureFile(file);
    },
    onCopied() {
      events.push("staged");
    },
    resetInput() {
      events.push("reset");
    },
    yieldTurn: async () => {},
  });

  assert.equal(events.filter((event) => event === "copy").length, 12);
  assert.equal(events.indexOf("reset"), events.length - 1);
  assert.ok(events.indexOf("copy") !== -1);
  assert.ok(events.indexOf("reset") > events.lastIndexOf("copy"));
  assert.ok(events.indexOf("reset") > events.lastIndexOf("staged"));
});

test("short FileList reports the received count honestly", async () => {
  let received = -1;
  const result = await ingestCaptureFileList(fakeFileList(albumFiles(3)), {
    onReceived(count) {
      received = count;
    },
    onCopied() {},
    yieldTurn: async () => {},
  });

  assert.equal(received, 3);
  assert.equal(result.fileListLength, 3);
  assert.equal(result.copied.length, 3);
  assert.match(captureBatchMessage(received, result.copied.length), /已收到 3 張/);
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
    capture.indexOf("async function addIncomingFiles"),
    capture.indexOf("function onTakePhoto"),
  );
  const chooseBlock = capture.slice(
    capture.indexOf("function onChoosePhotos"),
    capture.indexOf("function removePhoto"),
  );
  const uploadFn = capture.slice(
    capture.indexOf("async function startBackgroundPhotoUpload"),
    capture.indexOf("async function startBackgroundAudioUpload"),
  );

  assert.match(upload, /CAPTURE_UPLOAD_CONCURRENCY = 3/);
  assert.match(upload, /ingestCaptureFileList/);
  assert.match(upload, /copyCaptureFile/);
  assert.match(upload, /capturePrepareConcurrency/);
  assert.match(capture, /createWorkQueue\(\s*capturePrepareConcurrency/);
  assert.match(capture, /photoQueue\(\)\.enqueue/);
  assert.match(addBlock, /ingestCaptureFileList\(fileList/);
  assert.match(addBlock, /createStagedCapturePhotos\(\[file\]\)/);
  assert.match(addBlock, /captureBatchMessage\(progress\.fileListLength, next\.length\)/);
  assert.match(addBlock, /resetInput/);
  assert.doesNotMatch(addBlock, /snapshotFileList/);
  assert.doesNotMatch(addBlock, /URL\.createObjectURL/);
  assert.doesNotMatch(addBlock, /makeStagedPhotos/);
  assert.doesNotMatch(chooseBlock, /event\.target\.value = ""/);
  assert.match(uploadFn, /onDisplayReady/);
  assert.match(uploadFn, /createTinyPreviewUrl\(display\)/);
  assert.match(capture, /排隊中/);
  assert.match(prepare, /resizeHeight: 240/);
  assert.match(prepare, /isHeicPhoto\(file\)/);
  assert.match(prepare, /withExclusivePhotoDecode/);
  assert.doesNotMatch(capture, /from "@\/lib\/trips"/);
  assert.doesNotMatch(capture, /travelpayouts/i);
  assert.doesNotMatch(upload, /travelpayouts/i);
});
