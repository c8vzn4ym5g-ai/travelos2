"use client";

import { useEffect, useState } from "react";
import {
  UNPLAYABLE_MOMENT_AUDIO_COPY,
  canPlayAudioMime,
  resolveAudioMime,
} from "@/lib/moment-audio";

const AUDIO_FETCH_MS = 6000;
const AUDIO_PROBE_MS = 3000;

type PlayerStatus = "loading" | "ready" | "unplayable";

export function BenchAudio({ src }: { src: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    const controller = new AbortController();
    const fetchTimer = window.setTimeout(() => controller.abort(), AUDIO_FETCH_MS);

    void (async () => {
      try {
        const response = await fetch(src, {
          cache: "no-store",
          credentials: "omit",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("audio missing");
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        const mime = resolveAudioMime(bytes, response.headers.get("content-type"));
        if (!canPlayAudioMime(mime)) {
          if (!cancelled) {
            setStatus("unplayable");
          }
          return;
        }

        const blob = new Blob([bytes], { type: mime ?? "application/octet-stream" });
        created = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }

        setObjectUrl(created);
      } catch {
        if (!cancelled) {
          setStatus("unplayable");
        }
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(fetchTimer);
      controller.abort();
      if (created) {
        URL.revokeObjectURL(created);
      }
    };
  }, [src]);

  useEffect(() => {
    if (!objectUrl || status !== "loading") {
      return;
    }

    const probeTimer = window.setTimeout(() => {
      setStatus("unplayable");
    }, AUDIO_PROBE_MS);

    return () => {
      window.clearTimeout(probeTimer);
    };
  }, [objectUrl, status]);

  if (status === "unplayable") {
    return <p className="mt-4 text-sm leading-6 text-stone-500">{UNPLAYABLE_MOMENT_AUDIO_COPY}</p>;
  }

  return (
    <>
      {objectUrl ? (
        <audio
          className={status === "ready" ? "mt-4 w-full" : "hidden"}
          controls
          onCanPlay={() => setStatus("ready")}
          onError={() => setStatus("unplayable")}
          preload="metadata"
          src={objectUrl}
        />
      ) : null}
      {status === "loading" ? <p className="mt-4 text-sm leading-6 text-stone-500">聲音載入中…</p> : null}
    </>
  );
}
