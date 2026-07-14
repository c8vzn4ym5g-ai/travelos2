"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MusicTrack } from "@/lib/types";

type JourneyMusicPlayerProps = {
  tracks: MusicTrack[];
};

function normalize(value: string) {
  return value.toLowerCase().trim();
}

function findTrackForZone(tracks: MusicTrack[], zone: string) {
  const normalizedZone = normalize(zone);
  return (
    tracks.find((track) => track.triggerLabel && normalizedZone.includes(normalize(track.triggerLabel))) ??
    tracks[0] ??
    null
  );
}

export function JourneyMusicPlayer({ tracks }: JourneyMusicPlayerProps) {
  const playableTracks = useMemo(
    () => tracks.filter((track) => track.enabled && track.audioUrl.trim().length > 0),
    [tracks],
  );
  const [isOn, setIsOn] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState(playableTracks[0]?.id ?? "");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeTrack = playableTracks.find((track) => track.id === activeTrackId) ?? playableTracks[0] ?? null;

  useEffect(() => {
    if (!activeTrackId && playableTracks[0]) {
      setActiveTrackId(playableTracks[0].id);
    }
  }, [activeTrackId, playableTracks]);

  useEffect(() => {
    if (!playableTracks.length) {
      return;
    }

    const zones = Array.from(document.querySelectorAll<HTMLElement>("[data-music-zone]"));
    if (!zones.length) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((first, second) => second.intersectionRatio - first.intersectionRatio)[0];

        if (!visible) {
          return;
        }

        const zone = visible.target.getAttribute("data-music-zone") ?? "";
        const track = findTrackForZone(playableTracks, zone);
        if (track) {
          setActiveTrackId(track.id);
        }
      },
      { rootMargin: "-20% 0px -45% 0px", threshold: [0.25, 0.5, 0.75] },
    );

    zones.forEach((zone) => observer.observe(zone));
    return () => observer.disconnect();
  }, [playableTracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack) {
      return;
    }

    const targetVolume = Math.min(1, Math.max(0, activeTrack.volume));
    let fadeTimer: ReturnType<typeof setInterval> | null = null;

    if (isOn) {
      audio.volume = 0;
      audio.play().then(() => {
        fadeTimer = setInterval(() => {
          audio.volume = Math.min(targetVolume, audio.volume + 0.025);
          if (audio.volume >= targetVolume && fadeTimer) {
            clearInterval(fadeTimer);
          }
        }, 120);
      }).catch(() => setIsOn(false));
    } else {
      audio.pause();
    }

    return () => {
      if (fadeTimer) {
        clearInterval(fadeTimer);
      }
    };
  }, [activeTrack, isOn]);

  if (!activeTrack) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-full border border-white/70 bg-white/90 px-4 py-3 text-sm text-zinc-800 shadow-[0_20px_60px_rgba(30,41,59,0.18)] backdrop-blur">
      <audio key={activeTrack.id} loop ref={audioRef} src={activeTrack.audioUrl} />
      <div className="flex items-center justify-between gap-3">
        <button
          aria-label={isOn ? "Turn journey music off" : "Turn journey music on"}
          className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800"
          onClick={() => setIsOn((current) => !current)}
          type="button"
        >
          {isOn ? "Music on" : "Play music"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{activeTrack.title}</p>
          <p className="truncate text-xs text-zinc-500">{isOn ? "Changes gently as you read" : "Tap once to start"}</p>
        </div>
      </div>
    </div>
  );
}
