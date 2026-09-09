import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTURE_DOCK_RETRY_GUARD_MS,
  CAPTURE_PHOTO_HANG_MS,
  captureDockCountText,
  captureDockIsOpen,
  captureDockSelectedCount,
  captureDockRetryShouldRun,
  capturePhotoRetryDelayMs,
  capturePhotoStatusLabel,
  captureRoundNeedsResume,
  captureUploadIsHung,
  captureUploadShouldForceFail,
  clearCaptureRoundMeta,
  createMemoryCaptureFileStore,
  listRetryableCapturePhotoIds,
  readCaptureRoundMeta,
  reconcileCapturePhotosWithServer,
  waitForCaptureDockPaint,
  writeCaptureRoundMeta,
  yieldCaptureUi,
} from "../lib/capture-round-store.ts";

class MemoryStorage {
  #map = new Map();

  getItem(key) {
    return this.#map.has(key) ? this.#map.get(key) : null;
  }

  setItem(key, value) {
    this.#map.set(key, String(value));
  }

  removeItem(key) {
    this.#map.delete(key);
  }
}

test("sticky dock count stays on selected / received while the round is open", () => {
  assert.equal(
    captureDockCountText([
      { status: "queued" },
      { status: "queued" },
      { status: "uploading" },
    ]),
    "已選 3 · 上傳中 3 · 已收到 0",
  );
  assert.equal(
    captureDockCountText([
      { status: "uploaded" },
      { status: "uploaded" },
      { status: "uploading" },
      { status: "failed" },
      { status: "failed" },
      { status: "queued" },
    ]),
    "已選 6 · 上傳中 2 · 已收到 2 · 還沒進倉 2",
  );
  assert.equal(captureDockCountText([], 39), "已選 39");
  assert.equal(captureDockSelectedCount(0, 0), 0);
  assert.equal(captureDockSelectedCount(0, 39), 39);
  assert.equal(captureDockSelectedCount(31, 8), 31);
  assert.equal(captureDockIsOpen(0, 0), false);
  assert.equal(captureDockIsOpen(0, 39), true);
  assert.equal(captureDockIsOpen(31, 0), true);
  assert.equal(
    captureDockCountText(
      [
        { status: "uploaded" },
        { status: "uploading" },
      ],
      39,
    ),
    "已選 39 · 上傳中 1 · 已收到 1",
  );
  assert.doesNotMatch(captureDockCountText([{ status: "failed" }]), /失敗|失败/);
});

test("dock status labels never call a local thumbnail received", () => {
  assert.equal(capturePhotoStatusLabel("uploaded"), "已收到");
  assert.equal(capturePhotoStatusLabel("failed"), "再送");
  assert.equal(capturePhotoStatusLabel("uploading"), "上傳中");
  assert.equal(capturePhotoStatusLabel("queued"), "上傳中");
  assert.equal(capturePhotoRetryDelayMs(1), 1200);
  assert.equal(captureRoundNeedsResume([{ status: "uploaded" }, { status: "failed" }]), true);
  assert.equal(captureRoundNeedsResume([{ status: "uploaded" }]), false);
  assert.deepEqual(
    listRetryableCapturePhotoIds([
      { id: "a", status: "uploaded" },
      { id: "b", status: "failed" },
      { id: "c", status: "uploading" },
      { id: "d", status: "failed" },
    ]),
    ["b", "c", "d"],
  );
  assert.equal(captureDockRetryShouldRun(false, 3), true);
  assert.equal(captureDockRetryShouldRun(true, 3), false);
  assert.equal(captureDockRetryShouldRun(false, 0), false);
  assert.equal(captureDockRetryShouldRun(true, 3, 1_000, 2_000, 8_000), false);
  assert.equal(captureDockRetryShouldRun(true, 3, 1_000, 10_000, 8_000), true);
});

test("hung uploading without a live worker is forced off 上傳中", () => {
  assert.equal(
    captureUploadShouldForceFail({
      hasLiveUpload: false,
      now: 80_000,
      status: "uploading",
      uploadingSince: 1_000,
    }),
    true,
  );
  assert.equal(
    captureUploadShouldForceFail({
      hasLiveUpload: true,
      now: 20_000,
      status: "uploading",
      uploadingSince: 1_000,
    }),
    false,
  );
  assert.equal(CAPTURE_PHOTO_HANG_MS, 28_000);
  assert.equal(CAPTURE_DOCK_RETRY_GUARD_MS, 8_000);
  assert.equal(captureUploadIsHung("uploading", 1_000, 29_000), true);
  assert.equal(captureUploadIsHung("uploading", 1_000, 20_000), false);
  assert.equal(captureUploadIsHung("uploaded", 1_000, 80_000), false);
});

test("server photos for the round flip hung cards to uploaded", () => {
  const local = [
    { file: { name: "A.jpg" }, serverPhotoId: "p1", status: "uploaded" as const },
    { file: { name: "B.jpg" }, serverPhotoId: null, status: "uploading" as const },
  ];
  const server = [
    { id: "p1", originalFilename: "A.jpg" },
    { id: "p2", originalFilename: "B.jpg" },
  ];
  const next = reconcileCapturePhotosWithServer(local, server);
  assert.equal(next[1]?.status, "uploaded");
  assert.equal(next[1]?.serverPhotoId, "p2");
});

test("leftover warehouse photo lands on the one hung card", () => {
  const local = [
    { file: { name: "IMG_1.JPG" }, serverPhotoId: "a", status: "uploaded" as const },
    { file: { name: "IMG_2.JPG" }, serverPhotoId: null, status: "uploading" as const },
  ];
  const server = [
    { id: "a", originalFilename: "display-1.jpg" },
    { id: "b", originalFilename: "display-2.jpg" },
  ];
  const next = reconcileCapturePhotosWithServer(local, server);
  assert.equal(next[1]?.status, "uploaded");
  assert.equal(next[1]?.serverPhotoId, "b");
});

test("yieldCaptureUi resolves", async () => {
  await yieldCaptureUi(0);
});

test("dock paint yields twice so 已選 can show before ingest copies", async () => {
  const frames: Array<() => void> = [];
  const painted = waitForCaptureDockPaint({
    requestAnimationFrame(callback) {
      frames.push(callback);
      return frames.length;
    },
    setTimeout() {
      throw new Error("setTimeout must not run when rAF exists");
    },
  });
  assert.equal(frames.length, 1);
  frames.shift()?.();
  assert.equal(frames.length, 1);
  frames.shift()?.();
  await painted;
});

test("capture round meta round-trips and memory file store keeps the File", async () => {
  const storage = new MemoryStorage();
  const files = createMemoryCaptureFileStore();
  const photo = new File([new Uint8Array([1, 2, 3])], "IMG_1.JPG", { type: "image/jpeg" });
  await files.put("staged_1", photo);
  writeCaptureRoundMeta(
    {
      momentId: "moment_1",
      note: "",
      photos: [
        {
          id: "staged_1",
          lastModified: photo.lastModified,
          name: photo.name,
          retryCount: 1,
          serverPhotoId: null,
          size: photo.size,
          status: "uploading",
          type: photo.type,
        },
      ],
      v: 1,
    },
    storage,
  );

  const meta = readCaptureRoundMeta(storage);
  assert.equal(meta?.momentId, "moment_1");
  assert.equal(meta?.photos[0]?.status, "uploading");
  const stored = await files.get("staged_1");
  assert.equal(stored?.size, 3);
  clearCaptureRoundMeta(storage);
  assert.equal(readCaptureRoundMeta(storage), null);
});
