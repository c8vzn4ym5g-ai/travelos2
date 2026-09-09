export const CAPTURE_ROUND_META_KEY = "travelos-capture-round";
export const CAPTURE_ROUND_DB = "travelos-capture-round";
export const CAPTURE_ROUND_FILE_STORE = "files";
export const CAPTURE_PHOTO_RETRY_LIMIT = 4;
export const CAPTURE_PHOTO_RETRY_BASE_MS = 1200;

export type CaptureDockStatus = "queued" | "uploading" | "uploaded" | "failed";

export type CaptureRoundPhotoMeta = {
  id: string;
  lastModified: number;
  name: string;
  retryCount: number;
  serverPhotoId: string | null;
  size: number;
  status: CaptureDockStatus;
  type: string;
};

export type CaptureRoundMeta = {
  momentId: string | null;
  note: string;
  photos: CaptureRoundPhotoMeta[];
  v: 1;
};

export type CaptureRoundFileStore = {
  clear: () => Promise<void>;
  get: (id: string) => Promise<File | null>;
  put: (id: string, file: File) => Promise<void>;
};

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function capturePhotoStatusLabel(status: CaptureDockStatus) {
  if (status === "uploaded") {
    return "已收到";
  }
  if (status === "failed") {
    return "再送";
  }
  return "上傳中";
}

export function captureDockIsOpen(photoCount: number, selectedHint = 0) {
  return photoCount > 0 || selectedHint > 0;
}

export function captureDockCountText(
  photos: Array<{ status: CaptureDockStatus }>,
  selectedHint = 0,
) {
  const selected = Math.max(photos.length, selectedHint);
  if (photos.length === 0) {
    return `已選 ${selected}`;
  }
  const uploaded = photos.filter((photo) => photo.status === "uploaded").length;
  const uploading = photos.filter((photo) => photo.status === "queued" || photo.status === "uploading").length;
  const held = photos.filter((photo) => photo.status === "failed").length;
  const parts = [`已選 ${selected}`];
  if (uploading > 0) {
    parts.push(`上傳中 ${uploading}`);
  }
  parts.push(`已收到 ${uploaded}`);
  if (held > 0) {
    parts.push(`還沒進倉 ${held}`);
  }
  return parts.join(" · ");
}

type PaintScheduler = {
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  setTimeout: (callback: () => void, ms: number) => unknown;
};

export function waitForCaptureDockPaint(scheduler: PaintScheduler = globalThis) {
  return new Promise<void>((resolve) => {
    const raf = scheduler.requestAnimationFrame;
    if (typeof raf === "function") {
      raf.call(scheduler, () => {
        raf.call(scheduler, () => resolve());
      });
      return;
    }
    scheduler.setTimeout(() => resolve(), 0);
  });
}

export function capturePhotoRetryDelayMs(attempt: number) {
  return CAPTURE_PHOTO_RETRY_BASE_MS * Math.max(1, attempt);
}

export function captureRoundNeedsResume(photos: Array<{ status: CaptureDockStatus }>) {
  return photos.some((photo) => photo.status !== "uploaded");
}

export function listRetryableCapturePhotoIds(
  photos: Array<{ id: string; status: CaptureDockStatus }>,
) {
  return photos.filter((photo) => photo.status !== "uploaded").map((photo) => photo.id);
}

export function captureDockRetryShouldRun(inFlight: boolean, retryableCount: number) {
  return !inFlight && retryableCount > 0;
}

export function createMemoryCaptureFileStore(initial: Iterable<[string, File]> = []): CaptureRoundFileStore {
  const map = new Map(initial);
  return {
    async clear() {
      map.clear();
    },
    async get(id) {
      return map.get(id) ?? null;
    },
    async put(id, file) {
      map.set(id, file);
    },
  };
}

const memoryFileStore = createMemoryCaptureFileStore();

function openCaptureRoundDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(CAPTURE_ROUND_DB, 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(CAPTURE_ROUND_FILE_STORE)) {
          request.result.createObjectStore(CAPTURE_ROUND_FILE_STORE);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function createIndexedDbCaptureFileStore(): CaptureRoundFileStore {
  return {
    async clear() {
      const db = await openCaptureRoundDb();
      if (!db) {
        await memoryFileStore.clear();
        return;
      }
      await new Promise<void>((resolve) => {
        const tx = db.transaction(CAPTURE_ROUND_FILE_STORE, "readwrite");
        tx.objectStore(CAPTURE_ROUND_FILE_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    },
    async get(id) {
      const db = await openCaptureRoundDb();
      if (!db) {
        return memoryFileStore.get(id);
      }
      return new Promise((resolve) => {
        const tx = db.transaction(CAPTURE_ROUND_FILE_STORE, "readonly");
        const request = tx.objectStore(CAPTURE_ROUND_FILE_STORE).get(id);
        request.onsuccess = () => {
          const value = request.result;
          resolve(value instanceof File ? value : null);
        };
        request.onerror = () => resolve(null);
      });
    },
    async put(id, file) {
      const db = await openCaptureRoundDb();
      if (!db) {
        await memoryFileStore.put(id, file);
        return;
      }
      await new Promise<void>((resolve) => {
        const tx = db.transaction(CAPTURE_ROUND_FILE_STORE, "readwrite");
        tx.objectStore(CAPTURE_ROUND_FILE_STORE).put(file, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    },
  };
}

export function readCaptureRoundMeta(storage: StorageLike | null | undefined) {
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(CAPTURE_ROUND_META_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as CaptureRoundMeta;
    if (parsed.v !== 1 || !Array.isArray(parsed.photos)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeCaptureRoundMeta(meta: CaptureRoundMeta, storage: StorageLike | null | undefined) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(CAPTURE_ROUND_META_KEY, JSON.stringify(meta));
    return true;
  } catch {
    return false;
  }
}

export function clearCaptureRoundMeta(storage: StorageLike | null | undefined) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(CAPTURE_ROUND_META_KEY);
  } catch {
    // Private mode can block localStorage.
  }
}
