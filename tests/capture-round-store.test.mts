import assert from "node:assert/strict";
import test from "node:test";
import {
  CAPTURE_RETRY_ALL_LABEL,
  CAPTURE_RETRY_ONCE_LABEL,
  captureDockCountText,
  capturePhotoRetryDelayMs,
  capturePhotoStatusLabel,
  captureRoundNeedsResume,
  clearCaptureRoundMeta,
  createMemoryCaptureFileStore,
  listRetryableCapturePhotoIds,
  readCaptureRoundMeta,
  writeCaptureRoundMeta,
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
  assert.equal(
    captureDockCountText([{ status: "uploaded" }, { status: "uploaded" }]),
    "已選 2 · 已收到 2",
  );
  assert.doesNotMatch(captureDockCountText([{ status: "failed" }]), /失敗|失败/);
});

test("dock status labels never call a local thumbnail received", () => {
  assert.equal(capturePhotoStatusLabel("uploaded"), "已收到");
  assert.equal(capturePhotoStatusLabel("failed"), "再送一次");
  assert.equal(CAPTURE_RETRY_ONCE_LABEL, "再送一次");
  assert.equal(CAPTURE_RETRY_ALL_LABEL, "全部再送");
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
    ["b", "d"],
  );
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
