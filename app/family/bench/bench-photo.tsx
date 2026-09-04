"use client";

import { useEffect, useRef, useState } from "react";
import { FamGlyph } from "@/app/family/family-icons";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders } from "@/lib/family-session";
import { captureFileMime, driveFileIdFromStorageKey, isMomentVideo, momentPhotoPlayUrl } from "@/lib/moments";
import type { MomentPhoto } from "@/lib/types";

const THUMB_FETCH_MS = 55000;
const VIDEO_FETCH_MS = 90000;
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
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<"idle" | "loading" | "ready" | "failed">("idle");
  const video = isMomentVideo(photo);

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

  useEffect(() => {
    return () => {
      if (videoSrc) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  const label = photo.originalFilename || (video ? "影片" : "照片");

  async function playVideo() {
    if (!video || videoStatus === "loading") {
      return;
    }
    if (videoSrc) {
      setVideoStatus("ready");
      return;
    }

    setVideoStatus("loading");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), VIDEO_FETCH_MS);
    const fileId = driveFileIdFromStorageKey(photo.storageKey);
    const url = momentPhotoPlayUrl(momentId, photo.id, { fileId });

    try {
      const response = await fetch(url, {
        cache: "force-cache",
        headers: familyPinHeaders(sessionPin()),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("video missing");
      }
      const blob = await response.blob();
      const mime =
        photo.mimeType ||
        captureFileMime({ name: photo.originalFilename || "clip.mov", type: blob.type }) ||
        blob.type ||
        "video/quicktime";
      const playable = blob.type.startsWith("video/") ? blob : new Blob([blob], { type: mime });
      const objectUrl = URL.createObjectURL(playable);
      setVideoSrc(objectUrl);
      setVideoStatus("ready");
    } catch {
      setVideoStatus("failed");
    } finally {
      window.clearTimeout(timer);
    }
  }

  return (
    <li className="fam-thumb" ref={nodeRef}>
      {video && videoStatus === "ready" && videoSrc ? (
        <video controls playsInline preload="metadata" src={videoSrc} />
      ) : src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={label} decoding="async" src={src} />
      ) : (
        <div aria-label={failed ? label : `${label}載入中`} className="fam-thumb-fallback" role="img">
          {video ? <FamGlyph name="play" /> : null}
          {failed || video ? label : ""}
        </div>
      )}
      {video && videoStatus !== "ready" ? (
        <button className="fam-play fam-thumb-play" onClick={() => void playVideo()} type="button">
          <FamGlyph name="play" />
          <span className="fam-sr">{videoStatus === "loading" ? "影片載入中" : "播放影片"}</span>
        </button>
      ) : null}
      {video && videoStatus === "failed" ? <p className="fam-ref">這段還不能播，稍後再點一下。</p> : null}
    </li>
  );
}
