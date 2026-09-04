import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  CAPTURE_DUMP_LIMIT,
  CAPTURE_UPLOAD_CONCURRENCY,
  CAPTURE_UPLOAD_FAILED_MESSAGE,
  CAPTURE_VIDEO_MAX_BYTES,
  assertCaptureFileFits,
  captureBatchMessage,
  captureDumpCapMessage,
  captureDumpProgressMessage,
  captureFreshDumpRoundMessage,
  captureVideoTooLargeMessage,
  copyCaptureFile,
  createMomentSession,
  createStagedCapturePhotos,
  createTinyPreviewUrl,
  createWorkQueue,
  detachStagedCapturePhotos,
  ingestCaptureFileList,
  isCaptureDumpFile,
  shouldReplaceCaptureDumpRound,
  snapshotFileList,
  uploadDisplayPhoto,
  uploadOriginalPhotoInBackground,
} from "../lib/capture-upload.ts";
import { isCaptureVideoFile, isHeicPhoto, isMomentVideo } from "../lib/moments.ts";
import {
  maxUploadBytes,
  prepareDisplayPhoto,
  shouldKeepOriginal,
  skipCanvasMaxBytes,
} from "../lib/prepare-photo.ts";

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

function videoFileWithSize(bytes: number, name = "IMG_1504.MOV") {
  const file = new File([new Uint8Array([0, 0, 1, 2])], name, { type: "video/quicktime" });
  Object.defineProperty(file, "size", { configurable: true, value: bytes });
  return file;
}

function albumFiles(count: number, type = "image/heic") {
  const extension = type.includes("heic") ? "HEIC" : "JPG";
  return Array.from(
    { length: count },
    (_, index) =>
      new File([new Uint8Array([index, 1, 2, 3])], `IMG_${String(index).padStart(4, "0")}.${extension}`, { type }),
  );
}

function stubJpegCanvas(options: { bytes?: number; blobs?: Blob[] } = {}) {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const blobs = options.blobs;
  let blobIndex = 0;
  let decodeCalls = 0;
  let canvasCalls = 0;

  globalThis.createImageBitmap = (async () => {
    decodeCalls += 1;
    return {
      close() {},
      height: 3024,
      width: 4032,
    };
  }) as typeof createImageBitmap;

  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(tag: string) {
        canvasCalls += 1;
        if (tag !== "canvas") {
          throw new Error(`unexpected <${tag}>`);
        }
        return {
          height: 0,
          width: 0,
          getContext() {
            return { drawImage() {} };
          },
          toBlob(callback: BlobCallback) {
            const blob =
              blobs?.[blobIndex++] ??
              new Blob([new Uint8Array(options.bytes ?? 180_000).fill(9)], { type: "image/jpeg" });
            callback(blob);
          },
        };
      },
    },
  });

  return {
    get canvasCalls() {
      return canvasCalls;
    },
    get decodeCalls() {
      return decodeCalls;
    },
    restore() {
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
    },
  };
}

test("40 JPEG files start 40 POSTs without waiting for earlier POSTs to finish", async () => {
  const files = albumFiles(CAPTURE_DUMP_LIMIT, "image/jpeg");
  let posted = 0;
  const release: Array<() => void> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    posted += 1;
    await new Promise<void>((resolve) => {
      release.push(resolve);
    });
    return Response.json({ photo: { id: `photo_${posted}`, momentId: "moment_parallel" } });
  }) as typeof fetch;

  try {
    const jobs: Promise<unknown>[] = [];
    await ingestCaptureFileList(fakeFileList(files), {
      onCopied(file) {
        jobs.push(
          uploadDisplayPhoto({
            coordinates: null,
            file,
            momentId: "moment_parallel",
            pin: "test-capture-pin",
            takenAt: "2026-08-25T09:20:00.000Z",
          }),
        );
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(posted, 40, "all 40 POSTs start before any of them finish");
    assert.equal(release.length, 40);
    assert.ok(posted > CAPTURE_UPLOAD_CONCURRENCY);

    for (const resolve of release) {
      resolve();
    }
    await Promise.all(jobs);
    assert.equal(posted, 40);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("createWorkQueue(3) keeps at most 3 dump uploads in flight", async () => {
  const queue = createWorkQueue(CAPTURE_UPLOAD_CONCURRENCY);
  let inFlight = 0;
  let maxInFlight = 0;
  const jobs = Array.from({ length: CAPTURE_DUMP_LIMIT }, (_, index) =>
    queue.enqueue(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      return index;
    }),
  );

  const results = await Promise.all(jobs);
  assert.equal(CAPTURE_UPLOAD_CONCURRENCY, 3);
  assert.equal(CAPTURE_DUMP_LIMIT, 40);
  assert.equal(results.length, 40);
  assert.equal(maxInFlight, 3);
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
  });
  assert.equal(result.copied.length, 40);
  assert.equal(result.limited, false);
  assert.match(captureBatchMessage(40, 40), /已收到 40 張，分批上傳中/);
  assert.doesNotMatch(captureBatchMessage(40, 40), /這一輪先上傳/);
});

test("copy starts the upload in the same turn without yielding a frame", async () => {
  const events: string[] = [];
  const files = albumFiles(40);
  let rafCalls = 0;
  const originalRaf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    rafCalls += 1;
    return typeof originalRaf === "function" ? originalRaf.call(globalThis, callback) : 0;
  }) as typeof requestAnimationFrame;

  try {
    await ingestCaptureFileList(fakeFileList(files), {
      copyFile(file) {
        events.push(`copy:${file.name}`);
        return copyCaptureFile(file);
      },
      onCopied(file, { copiedCount }) {
        events.push(`upload:${copiedCount}:${file.name}`);
      },
      resetInput() {
        events.push("reset");
      },
    });
  } finally {
    if (typeof originalRaf === "function") {
      globalThis.requestAnimationFrame = originalRaf;
    } else {
      Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    }
  }

  assert.equal(rafCalls, 0);
  assert.equal(events.includes("yield"), false);
  assert.equal(events[0], "copy:IMG_0000.HEIC");
  assert.equal(events[1], "upload:1:IMG_0000.HEIC");
  assert.equal(events[2], "copy:IMG_0001.HEIC");
  assert.equal(events[3], "upload:2:IMG_0001.HEIC");
  const firstCopy = events.indexOf("copy:IMG_0000.HEIC");
  const firstUpload = events.indexOf("upload:1:IMG_0000.HEIC");
  const lastCopy = events.indexOf("copy:IMG_0039.HEIC");
  const lastUpload = events.indexOf("upload:40:IMG_0039.HEIC");
  const resetAt = events.indexOf("reset");

  assert.ok(firstCopy !== -1 && firstUpload !== -1 && lastCopy !== -1);
  assert.equal(firstUpload, firstCopy + 1);
  assert.ok(firstUpload < lastCopy);
  assert.ok(lastUpload > lastCopy);
  assert.equal(events.at(-1), "reset");
  assert.ok(resetAt > lastUpload);
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

test("a second Choose Photos dump is a fresh 40-photo round, not an append", () => {
  assert.equal(shouldReplaceCaptureDumpRound("choose-photos", 12), true);
  assert.equal(shouldReplaceCaptureDumpRound("choose-photos", 1), true);
  assert.equal(shouldReplaceCaptureDumpRound("choose-photos", 0), false);
  assert.equal(shouldReplaceCaptureDumpRound("take-photo", 12), false);
  assert.equal(shouldReplaceCaptureDumpRound("take-photo", 0), false);
  assert.match(captureFreshDumpRoundMessage(), /這一輪是新的 40 張，上一輪已在倉庫裡/);
  assert.match(captureFreshDumpRoundMessage(), /This round is a fresh 40; previous photos are already in the warehouse/);
  assert.match(captureDumpProgressMessage(40, 40, { freshRound: true }), /這一輪是新的 40 張/);
  assert.match(captureDumpProgressMessage(40, 40, { freshRound: true }), /已收到 40 張/);
  assert.doesNotMatch(captureDumpProgressMessage(40, 52, { freshRound: false }), /上一輪已在倉庫裡/);
});

test("detaching a leftover dump round clears the screen without aborting uploads", () => {
  const originalRevoke = URL.revokeObjectURL;
  const revoked: string[] = [];
  URL.revokeObjectURL = ((url: string) => {
    revoked.push(url);
  }) as typeof URL.revokeObjectURL;

  try {
    const leftover = [
      { abort: new AbortController(), id: "old_one", previewUrl: "blob:old-one" },
      { abort: new AbortController(), id: "old_two", previewUrl: null },
    ];
    const next = detachStagedCapturePhotos(leftover);
    assert.deepEqual(next, []);
    assert.equal(leftover[0]?.abort.signal.aborted, false);
    assert.equal(leftover[1]?.abort.signal.aborted, false);
    assert.deepEqual(revoked, ["blob:old-one"]);
  } finally {
    if (typeof originalRevoke === "function") {
      URL.revokeObjectURL = originalRevoke;
    } else {
      Reflect.deleteProperty(URL, "revokeObjectURL");
    }
  }
});

test("a new Choose Photos round posts to a new moment while the previous session stays put", async () => {
  let creates = 0;
  const first = createMomentSession(async () => {
    creates += 1;
    return { moment: { id: "moment_first_round" } };
  });
  const firstId = await first.ensure("2026-08-25T09:00:00.000Z");
  assert.equal(firstId, "moment_first_round");

  const second = createMomentSession(async () => {
    creates += 1;
    return { moment: { id: "moment_second_round" } };
  });
  const secondId = await second.ensure("2026-08-25T09:01:00.000Z");

  assert.equal(secondId, "moment_second_round");
  assert.equal(first.momentId, "moment_first_round");
  assert.equal(second.momentId, "moment_second_round");
  assert.equal(await first.ensure("2026-08-25T09:02:00.000Z"), "moment_first_round");
  assert.equal(creates, 2);
});

test("detached leftover POSTs keep landing on the previous moment", async () => {
  const posted: Array<{ file: string; momentId: string }> = [];
  const release: Array<() => void> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const form = init?.body as FormData;
    const file = form.get("file");
    assert.ok(file instanceof File);
    posted.push({ file: file.name, momentId: String(form.get("momentId")) });
    await new Promise<void>((resolve) => {
      release.push(resolve);
    });
    return Response.json({ photo: { id: `photo_${posted.length}`, momentId: String(form.get("momentId")) } });
  }) as typeof fetch;

  try {
    const firstSession = createMomentSession(async () => ({ moment: { id: "moment_old" } }));
    const firstMomentId = await firstSession.ensure("2026-08-25T09:10:00.000Z");
    const firstJobs: Promise<unknown>[] = [];
    await ingestCaptureFileList(fakeFileList(albumFiles(2, "image/jpeg")), {
      onCopied(file) {
        firstJobs.push(
          uploadDisplayPhoto({
            coordinates: null,
            file,
            momentId: firstMomentId,
            pin: "test-capture-pin",
            takenAt: "2026-08-25T09:10:00.000Z",
          }),
        );
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(posted.length, 2);
    assert.equal(
      posted.every((item) => item.momentId === "moment_old"),
      true,
    );

    const leftoverScreen = [{ id: "old", previewUrl: null }];
    const screen = detachStagedCapturePhotos(leftoverScreen);
    assert.deepEqual(screen, []);

    const secondSession = createMomentSession(async () => ({ moment: { id: "moment_new" } }));
    const secondMomentId = await secondSession.ensure("2026-08-25T09:11:00.000Z");
    const secondJobs: Promise<unknown>[] = [];
    await ingestCaptureFileList(fakeFileList(albumFiles(2, "image/jpeg")), {
      onCopied(file) {
        secondJobs.push(
          uploadDisplayPhoto({
            coordinates: null,
            file,
            momentId: secondMomentId,
            pin: "test-capture-pin",
            takenAt: "2026-08-25T09:11:00.000Z",
          }),
        );
      },
    });

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(posted.length, 4);
    assert.equal(
      posted.filter((item) => item.momentId === "moment_old").length,
      2,
    );
    assert.equal(
      posted.filter((item) => item.momentId === "moment_new").length,
      2,
    );
    assert.equal(firstSession.momentId, "moment_old");
    assert.equal(secondSession.momentId, "moment_new");

    for (const resolve of release) {
      resolve();
    }
    await Promise.all([...firstJobs, ...secondJobs]);
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("multi-megabyte JPEG dumps compress before the display POST", async () => {
  const jpeg = new File([new Uint8Array(2_204_120).fill(7)], "IMG_3104.jpg", { type: "image/jpeg" });
  assert.equal(jpeg.type, "image/jpeg");
  assert.equal(isHeicPhoto(jpeg), false);
  assert.ok(jpeg.size > skipCanvasMaxBytes);

  const stub = stubJpegCanvas({ bytes: 180_000 });
  const posted: File[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const file = (init?.body as FormData).get("file");
    assert.ok(file instanceof File);
    posted.push(file);
    return Response.json({ photo: { id: "moment_photo_jpeg", momentId: "moment_jpeg" } });
  }) as typeof fetch;

  try {
    const result = await uploadDisplayPhoto({
      coordinates: null,
      file: jpeg,
      momentId: "moment_jpeg",
      pin: "test-capture-pin",
      takenAt: "2026-08-25T08:56:54.000Z",
    });

    assert.equal(posted.length, 1);
    assert.notEqual(posted[0], jpeg);
    assert.equal(posted[0]?.type, "image/jpeg");
    assert.equal(posted[0]?.name, "IMG_3104.jpg");
    assert.equal(posted[0]?.size, 180_000);
    assert.ok(posted[0]!.size < jpeg.size);
    assert.equal(result.display, posted[0]);
    assert.equal(result.display.size, 180_000);
    assert.ok(stub.decodeCalls >= 1);
    assert.ok(stub.canvasCalls >= 1);
    assert.equal(shouldKeepOriginal(jpeg, result.display), true);
  } finally {
    globalThis.fetch = originalFetch;
    stub.restore();
  }
});

test("oversized JPEG dumps shrink further when still over maxUploadBytes", async () => {
  const jpeg = new File([new Uint8Array(4_600_000).fill(3)], "IMG_big.jpg", { type: "image/jpeg" });
  assert.ok(jpeg.size > maxUploadBytes);
  const stillHuge = new Blob([new Uint8Array(maxUploadBytes + 1).fill(4)], { type: "image/jpeg" });
  const shrunk = new Blob([new Uint8Array(220_000).fill(5)], { type: "image/jpeg" });
  const stub = stubJpegCanvas({ blobs: [stillHuge, shrunk] });

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
    assert.notEqual(posted[0], jpeg);
    assert.equal(posted[0]?.size, 220_000);
    assert.ok(posted[0]!.size < maxUploadBytes);
    assert.equal(result.display.size, 220_000);
    assert.ok(stub.canvasCalls >= 2);
    assert.equal(shouldKeepOriginal(jpeg, result.display), true);
  } finally {
    globalThis.fetch = originalFetch;
    stub.restore();
  }
});

test("40-file dump starts 40 POSTs without waiting on previews or earlier POSTs", async () => {
  const events: string[] = [];
  const release: Array<() => void> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    events.push("post");
    await new Promise<void>((resolve) => {
      release.push(resolve);
    });
    return Response.json({ photo: { id: `photo_${events.length}`, momentId: "moment_dump" } });
  }) as typeof fetch;

  try {
    const jobs = albumFiles(40).map((file, index) =>
      uploadDisplayPhoto({
        coordinates: null,
        file,
        momentId: "moment_dump",
        onDisplayReady: async () => {
          events.push(`preview:${index}`);
          await new Promise((resolve) => setTimeout(resolve, 30));
        },
        pin: "test-capture-pin",
        takenAt: "2026-08-25T07:00:00.000Z",
      }),
    );

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(events.filter((event) => event === "post").length, 40);
    assert.equal(release.length, 40);
    for (const resolve of release) {
      resolve();
    }
    await Promise.all(jobs);
    assert.equal(events.filter((event) => event === "post").length, 40);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tiny JPEG Choose Photos dump POSTs originals immediately and keeps the 40 cap", async () => {
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
  const release: Array<() => void> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const file = (init?.body as FormData).get("file");
    assert.ok(file instanceof File);
    posted.push(file);
    await new Promise<void>((resolve) => {
      release.push(resolve);
    });
    return Response.json({ photo: { id: `photo_${posted.length}`, momentId: "moment_jpeg_dump" } });
  }) as typeof fetch;

  try {
    const jobs = files.map((file) =>
      uploadDisplayPhoto({
        coordinates: null,
        file,
        momentId: "moment_jpeg_dump",
        pin: "test-capture-pin",
        takenAt: "2026-08-25T08:56:54.000Z",
      }).then((uploaded) => {
        assert.equal(uploaded.display, file);
      }),
    );

    await Promise.resolve();
    await Promise.resolve();
    assert.equal(posted.length, 40, "all 40 POSTs start before any of them finish");
    assert.equal(release.length, 40);
    assert.equal(decodeCalls, 0);

    for (const resolve of release) {
      resolve();
    }
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

test("large HEIC still skips canvas convert", async () => {
  const heic = new File([new Uint8Array(2_000_000).fill(1)], "IMG_1001.HEIC", { type: "image/heic" });
  const stub = stubJpegCanvas({ bytes: 12_000 });
  try {
    const display = await prepareDisplayPhoto(heic);
    assert.equal(display, heic);
    assert.equal(stub.decodeCalls, 0);
    assert.equal(stub.canvasCalls, 0);
  } finally {
    stub.restore();
  }
});

test("tiny JPEG prepare returns the original file without canvas convert", async () => {
  const jpeg = new File([new Uint8Array([1, 2, 3, 4])], "IMG_3104.jpg", { type: "image/jpeg" });
  assert.equal(isHeicPhoto(jpeg), false);
  assert.ok(jpeg.size <= skipCanvasMaxBytes);
  const started = Date.now();
  const display = await prepareDisplayPhoto(jpeg);
  assert.equal(display, jpeg);
  assert.ok(Date.now() - started < 50);
  assert.equal(shouldKeepOriginal(jpeg, display), false);

  const prepare = await readSource("lib/prepare-photo.ts");
  assert.match(prepare, /skipCanvasMaxBytes = 400_000/);
  assert.match(prepare, /file\.type === "image\/jpeg" && file\.size <= skipCanvasMaxBytes/);
  assert.match(prepare, /displayMaxEdge/);
  assert.match(prepare, /displayJpegQuality/);
});

test("a typical iPhone JPEG is compressed and the original stays queued separately", async () => {
  const jpeg = new File([new Uint8Array(3_145_728).fill(11)], "IMG_1787.jpg", { type: "image/jpeg" });
  assert.ok(jpeg.size > 2_000_000);
  const stub = stubJpegCanvas({ bytes: 240_000 });
  const posted: Array<{ field: string; name: string; size: number }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const form = init?.body as FormData;
    const file = form.get("file");
    const original = form.get("original");
    if (original instanceof File) {
      posted.push({ field: "original", name: original.name, size: original.size });
    }
    if (file instanceof File) {
      posted.push({ field: "file", name: file.name, size: file.size });
    }
    return Response.json({ photo: { id: "moment_photo_keep", momentId: "moment_keep" } });
  }) as typeof fetch;

  try {
    const display = await prepareDisplayPhoto(jpeg);
    assert.notEqual(display, jpeg);
    assert.equal(display.type, "image/jpeg");
    assert.equal(display.size, 240_000);
    assert.ok(display.size < 400_000);
    assert.equal(shouldKeepOriginal(jpeg, display), true);

    const uploaded = await uploadDisplayPhoto({
      coordinates: null,
      file: jpeg,
      momentId: "moment_keep",
      pin: "test-capture-pin",
      takenAt: "2026-08-28T08:56:54.000Z",
    });
    uploadOriginalPhotoInBackground({
      display: uploaded.display,
      momentId: uploaded.momentId,
      original: jpeg,
      photoId: uploaded.photo.id,
      pin: "test-capture-pin",
    });
    await Promise.resolve();
    await Promise.resolve();

    assert.equal(
      posted.some((item) => item.field === "file" && item.size === 240_000),
      true,
    );
    assert.equal(
      posted.some((item) => item.field === "original" && item.size === jpeg.size && item.name === "IMG_1787.jpg"),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    stub.restore();
  }
});

test("40 multi-megabyte JPEGs compress then start 40 display POSTs in parallel", async () => {
  const files = Array.from(
    { length: CAPTURE_DUMP_LIMIT },
    (_, index) =>
      new File([new Uint8Array(2_000_011).fill(index + 3)], `IMG_${String(index).padStart(4, "0")}.jpg`, {
        type: "image/jpeg",
      }),
  );
  const stub = stubJpegCanvas({ bytes: 160_000 });
  const posted: File[] = [];
  const release: Array<() => void> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const file = (init?.body as FormData).get("file");
    assert.ok(file instanceof File);
    posted.push(file);
    await new Promise<void>((resolve) => {
      release.push(resolve);
    });
    return Response.json({ photo: { id: `photo_${posted.length}`, momentId: "moment_jpeg_compress" } });
  }) as typeof fetch;

  try {
    const jobs = files.map((file) =>
      uploadDisplayPhoto({
        coordinates: null,
        file,
        momentId: "moment_jpeg_compress",
        pin: "test-capture-pin",
        takenAt: "2026-08-28T08:56:54.000Z",
      }),
    );

    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(posted.length, 40, "all 40 compressed POSTs start before any of them finish");
    assert.equal(release.length, 40);
    assert.equal(
      posted.every((file) => file.size === 160_000),
      true,
    );

    for (const resolve of release) {
      resolve();
    }
    const uploaded = await Promise.all(jobs);
    assert.equal(
      uploaded.every((item, index) => shouldKeepOriginal(files[index]!, item.display)),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    stub.restore();
  }
});

test("a real iPhone-sized JPEG becomes a few hundred KB display JPEG", async () => {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas");
  const source = createCanvas(4032, 3024);
  const context = source.getContext("2d");
  const pixels = context.createImageData(4032, 3024);
  for (let index = 0; index < pixels.data.length; index += 4) {
    pixels.data[index] = (index * 37) & 255;
    pixels.data[index + 1] = (index * 91) & 255;
    pixels.data[index + 2] = (index * 13) & 255;
    pixels.data[index + 3] = 255;
  }
  context.putImageData(pixels, 0, 0);
  const jpegBytes = source.toBuffer("image/jpeg", 95);
  const original = new File([jpegBytes], "IMG_4032.jpg", { type: "image/jpeg" });
  assert.ok(original.size > 1_000_000, `expected a large JPEG, got ${original.size} bytes`);

  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  globalThis.createImageBitmap = (async (blob: Blob) => {
    const image = await loadImage(Buffer.from(await blob.arrayBuffer()));
    return {
      close() {},
      height: image.height,
      image,
      width: image.width,
    };
  }) as typeof createImageBitmap;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      createElement(tag: string) {
        if (tag !== "canvas") {
          throw new Error(`unexpected <${tag}>`);
        }
        const state: { height: number; napi: ReturnType<typeof createCanvas> | null; width: number } = {
          height: 0,
          napi: null,
          width: 0,
        };
        return {
          get height() {
            return state.height;
          },
          set height(value: number) {
            state.height = value;
          },
          get width() {
            return state.width;
          },
          set width(value: number) {
            state.width = value;
          },
          getContext() {
            return {
              drawImage(image: { image?: unknown }, x: number, y: number, width: number, height: number) {
                state.napi = createCanvas(state.width, state.height);
                const draw = state.napi.getContext("2d");
                draw.drawImage((image.image ?? image) as never, x, y, width, height);
              },
            };
          },
          toBlob(callback: BlobCallback, _type?: string, quality?: number) {
            const qualityPct = Math.round((quality ?? 0.72) * 100);
            const buffer = state.napi?.toBuffer("image/jpeg", qualityPct);
            callback(buffer ? new Blob([buffer], { type: "image/jpeg" }) : null);
          },
        };
      },
    },
  });

  try {
    const display = await prepareDisplayPhoto(original);
    assert.notEqual(display, original);
    assert.equal(display.type, "image/jpeg");
    assert.ok(display.size < 500_000, `display should be a few hundred KB, got ${display.size} bytes`);
    assert.ok(display.size < original.size);
    assert.equal(shouldKeepOriginal(original, display), true);
  } finally {
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

test("capture page caps a dump at 40 and fires POSTs in parallel", async () => {
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
  const ingestFn = upload.slice(
    upload.indexOf("export async function ingestCaptureFileList"),
    upload.indexOf("export function createStagedCapturePhotos"),
  );

  assert.match(upload, /CAPTURE_DUMP_LIMIT = 40/);
  assert.match(upload, /CAPTURE_VIDEO_CHUNK_BYTES = 16 \* 1024 \* 1024/);
  assert.match(upload, /CAPTURE_VIDEO_SINGLE_PUT_MAX_BYTES = 80_000_000/);
  assert.match(upload, /ingestCaptureFileList/);
  assert.match(upload, /copyCaptureFile/);
  assert.match(upload, /captureDumpCapMessage/);
  assert.doesNotMatch(upload, /capturePrepareConcurrency/);
  assert.doesNotMatch(capture, /createWorkQueue/);
  assert.doesNotMatch(capture, /photoQueue/);
  assert.doesNotMatch(uploadFn, /\.enqueue\(/);
  assert.match(uploadFn, /const run = \(async \(\) => \{/);
  assert.match(uploadFn, /\}\)\(\);/);
  assert.doesNotMatch(ingestFn, /yieldToBrowser/);
  assert.doesNotMatch(ingestFn, /yieldTurn/);
  assert.doesNotMatch(ingestFn, /requestAnimationFrame/);
  assert.match(addBlock, /ingestCaptureFileList\(fileList/);
  assert.match(addBlock, /limit: CAPTURE_DUMP_LIMIT/);
  assert.match(addBlock, /createStagedCapturePhotos\(\[file\]\)/);
  assert.match(addBlock, /startBackgroundPhotoUpload\(photo\)/);
  assert.doesNotMatch(addBlock, /materializeCaptureVideoSlices\(file\)/);
  assert.match(addBlock, /captureVideoPreviewUrl\(file\)/);
  assert.match(addBlock, /shouldReplaceCaptureDumpRound\(source, photosRef\.current\.length\)/);
  assert.match(addBlock, /beginFreshDumpRound\(\)/);
  assert.match(addBlock, /captureDumpProgressMessage/);
  assert.match(addBlock, /resetInput/);
  assert.doesNotMatch(addBlock, /snapshotFileList/);
  assert.match(addBlock, /captureVideoPreviewUrl\(file\)/);
  assert.match(chooseBlock, /"choose-photos"/);
  assert.doesNotMatch(chooseBlock, /"take-photo"/);
  assert.doesNotMatch(chooseBlock, /event\.target\.value = ""/);
  assert.match(capture, /addIncomingFiles\(event\.target\.files, event\.target, "take-photo"\)/);
  assert.match(capture, /function beginFreshDumpRound/);
  assert.match(capture, /detachStagedCapturePhotos/);
  assert.match(capture, /momentSessionRef\.current = createLiveMomentSession\(\)/);
  assert.match(capture, /const session = momentSession\(\)/);
  assert.match(uploadFn, /session\.allocate\(takenAt\)/);
  assert.match(uploadFn, /session\.ensure\(takenAt\)/);
  assert.match(uploadFn, /retryMoment\(takenAt, status, session\)/);
  const freshRoundFn = capture.slice(
    capture.indexOf("function beginFreshDumpRound"),
    capture.indexOf("async function ensureMoment"),
  );
  assert.doesNotMatch(freshRoundFn, /\.abort\(\)/);
  assert.doesNotMatch(freshRoundFn, /removeUploadedPhotoInBackground/);
  assert.match(capture, /resetDraft\(\)/);
  assert.match(capture, /再選一次相簿會清掉畫面上的上一輪，上一輪已在倉庫裡/);
  assert.match(uploadFn, /onDisplayReady/);
  assert.match(uploadFn, /createTinyPreviewUrl\(display\)/);
  assert.match(capture, /排隊中/);
  assert.match(capture, /這一輪最多 40 張/);
  assert.match(prepare, /skipCanvasMaxBytes = 400_000/);
  assert.match(prepare, /file\.type === "image\/jpeg" && file\.size <= skipCanvasMaxBytes/);
  const displayUpload = upload.slice(
    upload.indexOf("export async function uploadDisplayPhoto"),
    upload.indexOf("export function uploadOriginalPhotoInBackground"),
  );
  assert.match(displayUpload, /await prepareDisplayPhoto\(source\)/);
  assert.doesNotMatch(displayUpload, /createImageBitmap\(/);
  assert.doesNotMatch(displayUpload, /canvas\.toBlob/);
  assert.doesNotMatch(prepare, /withExclusivePhotoDecode/);
  assert.doesNotMatch(capture, /from "@\/lib\/trips"/);
  assert.doesNotMatch(capture, /travelpayouts/i);
  assert.doesNotMatch(upload, /travelpayouts/i);
});

test("album dump keeps photos and videos in the same 40-file list", async () => {
  const files = [
    new File([new Uint8Array([1])], "IMG_0001.JPG", { type: "image/jpeg" }),
    new File([new Uint8Array([2])], "IMG_0002.MOV", { type: "video/quicktime" }),
    new File([new Uint8Array([3])], "notes.txt", { type: "text/plain" }),
    new File([new Uint8Array([4])], "clip.mp4", { type: "video/mp4" }),
    new File([new Uint8Array([5])], "IMG_0005.MOV", { type: "" }),
  ];
  assert.equal(isCaptureDumpFile(files[0]!), true);
  assert.equal(isCaptureVideoFile(files[1]!), true);
  assert.equal(isCaptureDumpFile(files[2]!), false);
  assert.equal(isCaptureVideoFile(files[4]!), true);

  const result = await ingestCaptureFileList(fakeFileList(files), {
    onCopied() {},
  });
  assert.equal(result.copied.length, 4);
  assert.deepEqual(
    result.copied.map((file) => file.name),
    ["IMG_0001.JPG", "IMG_0002.MOV", "clip.mp4", "IMG_0005.MOV"],
  );

  const staged = createStagedCapturePhotos(result.copied);
  assert.equal(staged.length, 4);
  assert.equal(staged.every((item) => item.previewUrl === null && item.status === "queued"), true);
});

test("a mixed 40-file dump still starts 40 POSTs in parallel", async () => {
  const files = Array.from({ length: CAPTURE_DUMP_LIMIT }, (_, index) => {
    if (index % 5 === 0) {
      return new File([new Uint8Array([index, 9])], `IMG_${String(index).padStart(4, "0")}.MOV`, {
        type: "video/quicktime",
      });
    }
    return new File([new Uint8Array([index, 1, 2, 3])], `IMG_${String(index).padStart(4, "0")}.JPG`, {
      type: "image/jpeg",
    });
  });
  let posted = 0;
  const release: Array<() => void> = [];
  const originalFetch = globalThis.fetch;
  let photoPosts = 0;
  let videoInits = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "POST").toUpperCase();
    const body = init?.body;
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      const file = body.get("file");
      assert.ok(file instanceof File);
      assert.equal(isCaptureVideoFile(file), false);
      photoPosts += 1;
      posted += 1;
      await new Promise<void>((resolve) => {
        release.push(resolve);
      });
      return Response.json({ photo: { id: `photo_${photoPosts}`, momentId: "moment_mixed", kind: "photo" } });
    }
    if (url.includes("/api/moments/photos/video") && method === "POST") {
      const payload = JSON.parse(typeof body === "string" ? body : "{}") as {
        complete?: unknown;
        fileId?: unknown;
      };
      if (payload.complete === true || typeof payload.fileId === "string") {
        return Response.json({ photo: { id: "photo_video", momentId: "moment_mixed", kind: "video" } });
      }
      videoInits += 1;
      posted += 1;
      await new Promise<void>((resolve) => {
        release.push(resolve);
      });
      return Response.json({
        session: `sess_${videoInits}`,
        uploadUrl: `https://www.googleapis.com/upload/drive/v3/files?upload_id=mix_${videoInits}`,
      });
    }
    if (url.includes("googleapis.com/upload/drive") && method === "PUT") {
      return Response.json({ id: "file_mix" });
    }
    if (url.includes("/api/moments/photos/video") && method === "PUT") {
      throw new Error("mixed dump must not proxy video hops through the Worker");
    }
    throw new Error(`unexpected fetch ${method} ${url}`);
  }) as typeof fetch;

  try {
    const jobs: Promise<unknown>[] = [];
    await ingestCaptureFileList(fakeFileList(files), {
      onCopied(file) {
        jobs.push(
          uploadDisplayPhoto({
            coordinates: null,
            file,
            momentId: "moment_mixed",
            pin: "test-capture-pin",
            takenAt: "2026-09-03T01:00:00.000Z",
          }),
        );
      },
    });
    const started = Date.now();
    while (posted < 40 && Date.now() - started < 500) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    assert.equal(posted, 40);
    assert.equal(photoPosts, 32);
    assert.equal(videoInits, 8);
    assert.equal(release.length, 40);
    for (const resolve of release) {
      resolve();
    }
    await Promise.all(jobs);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a 15s-class iPhone video is not rejected by the client size gate", async () => {
  assert.equal(CAPTURE_VIDEO_MAX_BYTES, 100_000_000);
  assert.equal(captureVideoTooLargeMessage(), CAPTURE_UPLOAD_FAILED_MESSAGE);
  assert.doesNotMatch(captureVideoTooLargeMessage(), /換一段短一點的/);
  assert.doesNotMatch(captureVideoTooLargeMessage(), /短一點/);

  const fifteenSeconds = videoFileWithSize(60_000_000, "IMG_1504.MOV");
  const alsoFine = videoFileWithSize(80_000_000, "clip.mp4");
  assert.equal(fifteenSeconds.size, 60_000_000);
  assert.doesNotThrow(() => assertCaptureFileFits(fifteenSeconds));
  assert.doesNotThrow(() => assertCaptureFileFits(alsoFine));
});

test("a video over the Worker ceiling fails that item and does not stall the rest of the dump", async () => {
  const huge = videoFileWithSize(CAPTURE_VIDEO_MAX_BYTES + 1, "FUKUOKA.MOV");
  const jpeg = new File([new Uint8Array([1, 2, 3, 4])], "IMG_3104.jpg", { type: "image/jpeg" });
  assert.ok(huge.size > CAPTURE_VIDEO_MAX_BYTES);

  const posted: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const file = (init?.body as FormData).get("file");
    assert.ok(file instanceof File);
    posted.push(file.name);
    return Response.json({ photo: { id: "photo_ok", momentId: "moment_video" } });
  }) as typeof fetch;

  try {
    const failed = uploadDisplayPhoto({
      coordinates: null,
      file: huge,
      momentId: "moment_video",
      pin: "test-capture-pin",
      takenAt: "2026-09-03T01:10:00.000Z",
    });
    const ok = uploadDisplayPhoto({
      coordinates: null,
      file: jpeg,
      momentId: "moment_video",
      pin: "test-capture-pin",
      takenAt: "2026-09-03T01:10:01.000Z",
    });
    await assert.rejects(failed, /上傳失敗/);
    await assert.rejects(failed, (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.doesNotMatch(error.message, /換一段短一點的/);
      return true;
    });
    const uploaded = await ok;
    assert.equal(uploaded.photo.id, "photo_ok");
    assert.deepEqual(posted, ["IMG_3104.jpg"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("video dumps skip canvas convert and keep a video kind on the moment photo", async () => {
  const movie = new File([new Uint8Array([0, 1, 2, 3])], "IMG_2001.MOV", { type: "video/quicktime" });
  const stub = stubJpegCanvas({ bytes: 12_000 });
  try {
    const display = await prepareDisplayPhoto(movie);
    assert.equal(display, movie);
    assert.equal(stub.decodeCalls, 0);
    assert.equal(stub.canvasCalls, 0);
    assert.equal(isMomentVideo({ kind: "video", mimeType: "video/quicktime", originalFilename: movie.name }), true);
    assert.equal(isMomentVideo({ kind: "photo", mimeType: "image/jpeg", originalFilename: "park.jpg" }), false);
    assert.equal(isMomentVideo({ mimeType: null, originalFilename: "clip.mp4" }), true);
  } finally {
    stub.restore();
  }
});
