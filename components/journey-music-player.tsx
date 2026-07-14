"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { MusicTrack } from "@/lib/types";

type JourneyMusicPlayerProps = {
  tracks: MusicTrack[];
};

const SECTION_SETTLE_MS = 7000;
const SECTION_SWITCH_COOLDOWN_MS = 22000;
const BETWEEN_TRACK_DELAY_MS = 4500;

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

function clearTimer(timerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>) {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
}

export function JourneyMusicPlayer({ tracks }: JourneyMusicPlayerProps) {
  const playableTracks = useMemo(
    () => tracks.filter((track) => track.enabled && track.audioUrl.trim().length > 0),
    [tracks],
  );
  const [isOn, setIsOn] = useState(false);
  const [activeTrackId, setActiveTrackId] = useState(playableTracks[0]?.id ?? "");
  const [isWaitingForNext, setIsWaitingForNext] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSwitchAtRef = useRef(0);
  const nextTrackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoneSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (track && track.id !== activeTrackId) {
          const now = Date.now();
          if (now - lastSwitchAtRef.current < SECTION_SWITCH_COOLDOWN_MS) {
            return;
          }

          clearTimer(zoneSwitchTimerRef);
          zoneSwitchTimerRef.current = setTimeout(() => {
            setActiveTrackId(track.id);
            lastSwitchAtRef.current = Date.now();
          }, SECTION_SETTLE_MS);
        }
      },
      { rootMargin: "-20% 0px -45% 0px", threshold: [0.25, 0.5, 0.75] },
    );

    zones.forEach((zone) => observer.observe(zone));
    return () => {
      observer.disconnect();
      clearTimer(zoneSwitchTimerRef);
    };
  }, [activeTrackId, playableTracks]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !activeTrack) {
      return;
    }

    const targetVolume = Math.min(1, Math.max(0, activeTrack.volume));
    let fadeTimer: ReturnType<typeof setInterval> | null = null;

    if (isOn) {
      setIsWaitingForNext(false);
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

  useEffect(() => {
    if (!isOn) {
      clearTimer(nextTrackTimerRef);
      clearTimer(zoneSwitchTimerRef);
      setIsWaitingForNext(false);
    }
  }, [isOn]);

  useEffect(() => {
    return () => {
      clearTimer(nextTrackTimerRef);
      clearTimer(zoneSwitchTimerRef);
    };
  }, []);

  function moveToNextTrack() {
    if (!activeTrack) {
      setIsOn(false);
      return;
    }

    const activeIndex = playableTracks.findIndex((track) => track.id === activeTrack.id);
    const nextTrack = playableTracks[(activeIndex + 1) % playableTracks.length];

    setIsWaitingForNext(true);
    if (nextTrack && nextTrack.id !== activeTrack.id) {
      clearTimer(nextTrackTimerRef);
      nextTrackTimerRef.current = setTimeout(() => {
        setActiveTrackId(nextTrack.id);
        setIsWaitingForNext(false);
        lastSwitchAtRef.current = Date.now();
      }, BETWEEN_TRACK_DELAY_MS);
      return;
    }

    setIsOn(false);
  }

  function handleTrackEnded() {
    moveToNextTrack();
  }

  if (!activeTrack) {
    return null;
  }

  return (
    <div className="fixed right-4 top-4 z-40 flex max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border border-white/70 bg-white/90 p-2 text-sm text-zinc-800 shadow-[0_16px_45px_rgba(30,41,59,0.16)] backdrop-blur sm:right-6 sm:top-6">
      <audio key={activeTrack.id} onEnded={handleTrackEnded} ref={audioRef} src={activeTrack.audioUrl} />
      <button
        aria-label={isOn ? "Turn journey music off" : "Turn journey music on"}
        className={`grid h-10 w-10 place-items-center rounded-full text-base font-semibold transition ${
          isOn ? "bg-teal-800 text-white" : "bg-zinc-950 text-white hover:bg-zinc-800"
        }`}
        onClick={() => {
          setIsOn((current) => !current);
        }}
        title={isOn ? "Music on" : "Play music"}
        type="button"
      >
        <span aria-hidden="true">{"\u266a"}</span>
      </button>
      <div className={isOn ? "min-w-0 max-w-44 pr-2 sm:max-w-56" : "hidden sm:block sm:max-w-28 sm:pr-2"}>
        <p className="truncate text-xs font-semibold">{isOn ? activeTrack.title : "Music"}</p>
        <p className="truncate text-[0.68rem] text-zinc-500">
          {isOn ? (isWaitingForNext ? "Next song in a moment" : "One calm pass") : "Tap to play"}
        </p>
      </div>
    </div>
  );
}
