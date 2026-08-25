import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  CAPTURE_DUMP_LIMIT,
  CAPTURE_UPLOAD_CONCURRENCY,
  captureBatchMessage,
  captureDumpCapMessage,
  copyCaptureFile,
  createStagedCapturePhotos,
  createTinyPreviewUrl,
  createWorkQueue,
  ingestCaptureFileList,
  snapshotFileList,
  uploadDisplayPhoto,
} from "../lib/capture-upload.ts";
import { isHeicPhoto } from "../lib/moments.ts";
import { maxUploadBytes, prepareDisplayPhoto } from "../lib/prepare-photo.ts";

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

test("dump uploads at concurrency 3, not a serial iOS prepare queue", async () => {
  assert.equal(CAPTURE_UPLOAD_CONCURRENCY, 3);
  const queue = createWorkQueue();
  let active = 0;
  let maxActive = 0;
  let started = 0;

  const jobs = Array.from({ length: CAPTURE_DUMP_LIMIT }, (_, index) =>
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
  assert.equal(queue.pendingCount, CAPTURE_DUMP_LIMIT - CAPTURE_UPLOAD_CONCURRENCY);

  const results = await Promise.all(jobs);
  assert.equal(results.length, CAPTURE_DUMP_LIMIT);
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

test("staging a dump does not create object URLs", async () => {
  const original = URL.createObjectURL;
  let created = 0;
  URL.createObjectURL = ((blob: Blob) => {
    created += 1;
    return typeof original === "function" ? original.call(URL, blob) : `blob:test:${created}`;
  }) as typeof URL.createObjectURL;

  try {
    const files = albumFiles(CAPTURE_DUMP_LIMIT);
    const list = fakeFileList(files);
    const snapshotted = snapshotFileList(list);
    assert.equal(snapshotted.length, CAPTURE_DUMP_LIMIT);

    const staged = createStagedCapturePhotos(snapshotted);
    assert.equal(staged.length, CAPTURE_DUMP_LIMIT);
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

test("a Choose Photos dump is capped at 40 files", async () => {
  assert.equal(CAPTURE_DUMP_LIMIT, 40);
  const copiedNames: string[] = [];
  const result = await ingestCaptureFileList(fakeFileList(albumFiles(100)), {
    copyFile(file) {
      copiedNames.push(file.name);
      return copyCaptureFile(file);
    },
    onCopied() {},
    yieldTurn: async () => {},
  });

  assert.equal(result.fileListLength, 100);
  assert.equal(result.copied.length, 40);
  assert.equal(result.limited, true);
  assert.equal(copiedNames.length, 40);
  assert.equal(copiedNames[0], "IMG_0000.HEIC");
  assert.equal(copiedNames[39], "IMG_0039.HEIC");
  assert.equal(copiedNames.includes("IMG_0040.HEIC"), false);
  assert.match(captureDumpCapMessage(), /這一輪先上傳 40 張，其餘請再選一次繼續傳/);
  assert.equal(captureBatchMessage(100, 40), captureDumpCapMessage());
});

test("a JPEG Choose Photos dump is still capped at 40 files", async () => {
  const result = await ingestCaptureFileList(fakeFileList(albumFiles(100, "image/jpeg")), {
    onCopied() {},
    yieldTurn: async () => {},
  });

  assert.equal(result.fileListLength, 100);
  assert.equal(result.copied.length, 40);
  assert.equal(result.limited, true);
  assert.equal(result.copied[0]?.name, "IMG_0000.JPG");
  assert.equal(result.copied[0]?.type, "image/jpeg");
  assert.equal(result.copied[39]?.name, "IMG_0039.JPG");
  assert.equal(
    result.copied.every((file) => file.type === "image/jpeg" && !isHeicPhoto(file)),
    true,
  );
});

test("selecting 40 or fewer does not show the cap message", async () => {
  const result = await ingestCaptureFileList(fakeFileList(albumFiles(40)), {
    onCopied() {},
    yieldTurn: async () => {},
  });
  assert.equal(result.copied.length, 40);
  assert.equal(result.limited, false);
  assert.match(captureBatchMessage(40, 40), /已收到 40 張，分批上傳中/);
  assert.doesNotMatch(captureBatchMessage(40, 40), /這一輪先上傳/);
});

test("first upload may start before the rest of the dump is staged", async () => {
  const events: string[] = [];
  const files = albumFiles(40);

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
  const lastCopy = events.indexOf("copy:IMG_0039.HEIC");
  const lastStage = events.indexOf("stage:40");
  const resetAt = events.indexOf("reset");

  assert.ok(firstCopy !== -1 && firstUpload !== -1 && lastCopy !== -1);
  assert.ok(firstUpload > firstCopy);
  assert.ok(firstUpload < lastCopy);
  assert.ok(firstUpload < lastStage);
  assert.ok(resetAt > lastCopy);
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
  assert.equal(result.limited, false);
  assert.match(captureBatchMessage(received, result.copied.length), /已收到 3 張/);
});

test("batch message reports how many were received", () => {
  assert.match(captureBatchMessage(12, 12), /已收到 12 張，分批上傳中/);
  assert.match(captureBatchMessage(12, 18), /目前共 18 張，會繼續傳到倉庫/);
  assert.match(captureBatchMessage(0, 0), /請選照片/);
});

test("photo POST does not wait on the preview hook", async () => {
  const jpeg = new File([new Uint8Array([1, 2, 3, 4])], "park.jpg", { type: "image/jpeg" });
  let posted = 0;
  let postedFile: FormDataEntryValue | null = null;
  let previewDone = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    posted += 1;
    postedFile = (init?.body as FormData).get("file");
    assert.equal(previewDone, false);
    return Response.json({ photo: { id: "moment_photo_ready", momentId: "moment_ready" } });
  }) as typeof fetch;

  try {
    const uploaded = uploadDisplayPhoto({
      coordinates: null,
      file: jpeg,
      momentId: "moment_ready",
      onDisplayReady: async () => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        previewDone = true;
      },
      pin: "test-capture-pin",
      takenAt: "2026-08-25T05:55:25.000Z",
    });

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(posted, 1);
    assert.equal(postedFile, jpeg);
    const result = await uploaded;
    assert.equal(result.photo.id, "moment_photo_ready");
    assert.equal(result.display, jpeg);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("JPEG dump files POST the original without canvas convert", async () => {
  const jpeg = new File([new Uint8Array(1_204_120).fill(7)], "IMG_3104.jpg", { type: "image/jpeg" });
  assert.equal(jpeg.type, "image/jpeg");
  assert.equal(isHeicPhoto(jpeg), false);

  let decodeCalls = 0;
  let canvasCalls = 0;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  globalThis.createImageBitmap = (async () => {
    decodeCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    throw new Error("JPEG dumps must not decode before POST");
  }) as typeof createImageBitmap;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(tag: string) {
        canvasCalls += 1;
        throw new Error(`JPEG dumps must not create <${tag}> before POST`);
      },
    },
  });

  let postedAt: number | null = null;
  const posted: File[] = [];
  const started = Date.now();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    postedAt = Date.now() - started;
    const file = (init?.body as FormData).get("file");
    assert.ok(file instanceof File);
    posted.push(file);
    return Response.json({ photo: { id: "moment_photo_jpeg", momentId: "moment_jpeg" } });
  }) as typeof fetch;

  try {
    const uploaded = uploadDisplayPhoto({
      coordinates: null,
      file: jpeg,
      momentId: "moment_jpeg",
      pin: "test-capture-pin",
      takenAt: "2026-08-25T08:56:54.000Z",
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(posted.length, 1, "first POST starts immediately");
    assert.ok(postedAt !== null && postedAt < 50);
    assert.equal(posted[0], jpeg);
    assert.equal(posted[0]?.type, "image/jpeg");
    assert.equal(posted[0]?.name, "IMG_3104.jpg");
    assert.equal(decodeCalls, 0);
    assert.equal(canvasCalls, 0);

    const result = await uploaded;
    assert.equal(result.display, jpeg);
    assert.equal(decodeCalls, 0);
    assert.equal(canvasCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalCreateImageBitmap === "function") {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      Reflect.deleteProperty(globalThis, "createImageBitmap");
    }
    if (originalDocument === undefined) {
      Reflect.deleteProperty(globalThis, "document");
    } else {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: originalDocument,
      });
    }
  }
});

test("oversized JPEG dumps POST original instead of canvas-compressing", async () => {
  const jpeg = new File([new Uint8Array(4_600_000).fill(3)], "IMG_big.jpg", { type: "image/jpeg" });
  assert.ok(jpeg.size > maxUploadBytes);
  let decodeCalls = 0;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = (async () => {
    decodeCalls += 1;
    throw new Error("oversized JPEG dumps must not canvas-compress");
  }) as typeof createImageBitmap;

  const posted: File[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const file = (init?.body as FormData).get("file");
    assert.ok(file instanceof File);
    posted.push(file);
    return Response.json({ photo: { id: "moment_photo_big", momentId: "moment_big" } });
  }) as typeof fetch;

  try {
    const result = await uploadDisplayPhoto({
      coordinates: null,
      file: jpeg,
      momentId: "moment_big",
      pin: "test-capture-pin",
      takenAt: "2026-08-25T08:56:54.000Z",
    });
    assert.equal(posted.length, 1);
    assert.equal(posted[0], jpeg);
    assert.equal(result.display, jpeg);
    assert.equal(decodeCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalCreateImageBitmap === "function") {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      Reflect.deleteProperty(globalThis, "createImageBitmap");
    }
  }
});

test("40-file dump starts many POSTs without waiting on previews", async () => {
  const events: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    events.push("post");
    return Response.json({ photo: { id: `photo_${events.length}`, momentId: "moment_dump" } });
  }) as typeof fetch;

  try {
    const queue = createWorkQueue();
    const postsStarted: number[] = [];
    const jobs = albumFiles(40).map((file, index) =>
      queue.enqueue(async () => {
        await uploadDisplayPhoto({
          coordinates: null,
          file,
          momentId: "moment_dump",
          onDisplayReady: async () => {
            events.push(`preview:${index}`);
            await new Promise((resolve) => setTimeout(resolve, 30));
          },
          pin: "test-capture-pin",
          takenAt: "2026-08-25T07:00:00.000Z",
        });
        postsStarted.push(index);
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 15));
    const postsBeforePreviewsFinish = events.filter((event) => event === "post").length;
    assert.ok(postsBeforePreviewsFinish >= CAPTURE_UPLOAD_CONCURRENCY);
    await Promise.all(jobs);
    assert.equal(events.filter((event) => event === "post").length, 40);
    assert.equal(postsStarted.length, 40);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("JPEG Choose Photos dump POSTs originals immediately and keeps the 40 cap", async () => {
  const files = albumFiles(CAPTURE_DUMP_LIMIT, "image/jpeg");
  assert.equal(files.length, 40);
  assert.equal(
    files.every((file) => file.type === "image/jpeg" && !isHeicPhoto(file)),
    true,
  );

  let decodeCalls = 0;
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  globalThis.createImageBitmap = (async () => {
    decodeCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 3000));
    throw new Error("JPEG dumps must not canvas convert before POST");
  }) as typeof createImageBitmap;

  const posted: File[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const file = (init?.body as FormData).get("file");
    assert.ok(file instanceof File);
    posted.push(file);
    return Response.json({ photo: { id: `photo_${posted.length}`, momentId: "moment_jpeg_dump" } });
  }) as typeof fetch;

  try {
    const queue = createWorkQueue();
    const jobs = files.map((file) =>
      queue.enqueue(async () => {
        const uploaded = await uploadDisplayPhoto({
          coordinates: null,
          file,
          momentId: "moment_jpeg_dump",
          pin: "test-capture-pin",
          takenAt: "2026-08-25T08:56:54.000Z",
        });
        assert.equal(uploaded.display, file);
      }),
    );

    await new Promise((resolve) => setTimeout(resolve, 15));
    assert.ok(posted.length >= CAPTURE_UPLOAD_CONCURRENCY, "first POSTs start immediately");
    assert.equal(decodeCalls, 0);

    await Promise.all(jobs);
    assert.equal(posted.length, 40);
    assert.deepEqual(posted, files);
    assert.equal(decodeCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    if (typeof originalCreateImageBitmap === "function") {
      globalThis.createImageBitmap = originalCreateImageBitmap;
    } else {
      Reflect.deleteProperty(globalThis, "createImageBitmap");
    }
  }
});

test("HEIC prepare is cheap and does not exclusive-decode", async () => {
  const heic = new File([new Uint8Array([0, 1, 2, 3, 4])], "IMG_1001.HEIC", { type: "image/heic" });
  const started = Date.now();
  const display = await prepareDisplayPhoto(heic);
  assert.equal(display, heic);
  assert.ok(Date.now() - started < 50);

  const prepare = await readSource("lib/prepare-photo.ts");
  assert.doesNotMatch(prepare, /withExclusivePhotoDecode/);
  assert.doesNotMatch(prepare, /8000/);
});

test("JPEG prepare returns the original file without canvas convert", async () => {
  const jpeg = new File([new Uint8Array([1, 2, 3, 4])], "IMG_3104.jpg", { type: "image/jpeg" });
  assert.equal(isHeicPhoto(jpeg), false);
  const started = Date.now();
  const display = await prepareDisplayPhoto(jpeg);
  assert.equal(display, jpeg);
  assert.ok(Date.now() - started < 50);

  const prepare = await readSource("lib/prepare-photo.ts");
  assert.match(prepare, /isHeicPhoto\(file\) \|\| file\.type === "image\/jpeg"/);
});

test("capture page caps a dump at 40 and keeps the fast upload queue", async () => {
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
  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.match(upload, /ingestCaptureFileList/);
  assert.match(upload, /copyCaptureFile/);
  assert.match(upload, /captureDumpCapMessage/);
  assert.doesNotMatch(upload, /capturePrepareConcurrency/);
  assert.match(capture, /createWorkQueue\(\)/);
  assert.match(capture, /photoQueue\(\)\.enqueue/);
  assert.match(addBlock, /ingestCaptureFileList\(fileList/);
  assert.match(addBlock, /limit: CAPTURE_DUMP_LIMIT/);
  assert.match(addBlock, /createStagedCapturePhotos\(\[file\]\)/);
  assert.match(addBlock, /resetInput/);
  assert.doesNotMatch(addBlock, /snapshotFileList/);
  assert.doesNotMatch(addBlock, /URL\.createObjectURL/);
  assert.doesNotMatch(chooseBlock, /event\.target\.value = ""/);
  assert.match(uploadFn, /onDisplayReady/);
  assert.match(uploadFn, /createTinyPreviewUrl\(display\)/);
  assert.match(capture, /排隊中/);
  assert.match(capture, /這一輪最多 40 張/);
  assert.match(prepare, /isHeicPhoto\(file\) \|\| file\.type === "image\/jpeg"/);
  const displayUpload = upload.slice(
    upload.indexOf("export async function uploadDisplayPhoto"),
    upload.indexOf("export function uploadOriginalPhotoInBackground"),
  );
  assert.match(displayUpload, /await prepareDisplayPhoto\(input\.file\)/);
  assert.doesNotMatch(displayUpload, /createImageBitmap\(/);
  assert.doesNotMatch(displayUpload, /canvas\.toBlob/);
  assert.doesNotMatch(prepare, /withExclusivePhotoDecode/);
  assert.doesNotMatch(capture, /from "@\/lib\/trips"/);
  assert.doesNotMatch(capture, /travelpayouts/i);
  assert.doesNotMatch(upload, /travelpayouts/i);
});
