"use client";

import { useEffect, useRef, useState } from "react";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders } from "@/lib/family-session";
import { driveFileIdFromStorageKey, momentPhotoPlayUrl } from "@/lib/moments";
import type { MomentPhoto } from "@/lib/types";

const THUMB_FETCH_MS = 55000;
const THUMB_CONCURRENCY = 2;

let thumbInflight = 0;
const thumbWaiters: Array<() => void> = [];

function acquireThumbSlot() {
  if (thumbInflight < THUMB_CONCURRENCY) {
    thumbInflight += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    thumbWaiters.push(resolve);
  });
}

function releaseThumbSlot() {
  const next = thumbWaiters.shift();
  if (next) {
    next();
    return;
  }
  thumbInflight = Math.max(0, thumbInflight - 1);
}

function sessionPin() {
  return window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? "";
}

export function BenchPhotoThumb({ momentId, photo }: { momentId: string; photo: MomentPhoto }) {
  const nodeRef = useRef<HTMLLIElement>(null);
  const [visible, setVisible] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || visible) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), THUMB_FETCH_MS);
    const fileId = driveFileIdFromStorageKey(photo.storageKey);
    const url = momentPhotoPlayUrl(momentId, photo.id, { fileId, variant: "thumb" });

    void (async () => {
      await acquireThumbSlot();
      try {
        if (cancelled) {
          return;
        }
        const response = await fetch(url, {
          cache: "force-cache",
          headers: familyPinHeaders(sessionPin()),
          signal: controller.signal,
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (!response.ok || !contentType.startsWith("image/")) {
          throw new Error("thumb missing");
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          objectUrl = null;
          return;
        }
        setSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      } finally {
        releaseThumbSlot();
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controller.abort();
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [momentId, photo.id, photo.storageKey, visible]);

  const label = photo.originalFilename || "照片";

  return (
    <li className="fam-thumb" ref={nodeRef}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={label} decoding="async" src={src} />
      ) : (
        <div aria-label={failed ? label : `${label}載入中`} className="fam-thumb-fallback" role="img">
          {failed ? label : ""}
        </div>
      )}
    </li>
  );
}
