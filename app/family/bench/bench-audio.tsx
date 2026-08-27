"use client";

import { useEffect, useState } from "react";
import { MomentAudioPlayer } from "@/app/family/moment-audio-player";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders } from "@/lib/family-session";
import { UNPLAYABLE_MOMENT_AUDIO_COPY, momentAudioPlayUrl, resolveAudioMime } from "@/lib/moment-audio";
import { preparePlayableAudio } from "@/lib/moment-audio-playback";

const AUDIO_FETCH_MS = 8000;

type PlayerStatus = "loading" | "ready" | "unplayable";

function sessionPin() {
  return window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? "";
}

export function BenchAudio({ momentId }: { momentId: string }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [status, setStatus] = useState<PlayerStatus>("loading");

  useEffect(() => {
    let cancelled = false;
    let created: string | null = null;
    const controller = new AbortController();
    const fetchTimer = window.setTimeout(() => controller.abort(), AUDIO_FETCH_MS);

    void (async () => {
      try {
        const response = await fetch(momentAudioPlayUrl(momentId), {
          cache: "no-store",
          headers: familyPinHeaders(sessionPin()),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("audio missing");
        }

        const raw = new Uint8Array(await response.arrayBuffer());
        const prepared = await preparePlayableAudio(
          new Blob([raw], { type: resolveAudioMime(raw, response.headers.get("content-type")) ?? "audio/mp4" }),
        );
        created = URL.createObjectURL(prepared.file);
        if (cancelled) {
          URL.revokeObjectURL(created);
          return;
        }

        setBytes(prepared.bytes);
        setDurationSeconds(prepared.durationSeconds);
        setObjectUrl(created);
        setStatus("ready");
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
  }, [momentId]);

  if (status === "unplayable") {
    return <p className="mt-4 text-sm leading-6 text-stone-500">{UNPLAYABLE_MOMENT_AUDIO_COPY}</p>;
  }

  if (status === "loading" || !objectUrl) {
    return <p className="mt-4 text-sm leading-6 text-stone-500">聲音載入中…</p>;
  }

  return <MomentAudioPlayer bytes={bytes} durationSeconds={durationSeconds} src={objectUrl} />;
}
