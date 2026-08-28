"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { startLaplandHeroPlayback, unmuteLaplandHero } from "@/lib/lapland-hero-playback";
import {
  LAPLAND_HERO_VIDEO_SRC,
  LAPLAND_SEASON_LABEL,
} from "@/lib/lapland-storefront-copy";

export const LAPLAND_TAP_FOR_SOUND_LABEL = "輕點開聲音 / Tap for sound";

export function LaplandPublicCut() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [needsTapForSound, setNeedsTapForSound] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    let cancelled = false;

    void startLaplandHeroPlayback(video).then((result) => {
      if (!cancelled && result === "blocked") {
        setNeedsTapForSound(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const hideCueIfAudible = useCallback(() => {
    const video = videoRef.current;
    if (video && !video.muted && video.volume > 0) {
      setNeedsTapForSound(false);
    }
  }, []);

  function handleTapForSound(event: { preventDefault: () => void; stopPropagation: () => void }) {
    event.preventDefault();
    event.stopPropagation();
    const video = videoRef.current;
    if (!video) {
      return;
    }

    void unmuteLaplandHero(video)
      .then(() => {
        window.requestAnimationFrame(() => setNeedsTapForSound(false));
      })
      .catch(() => {
        // Keep the cue if the tap did not actually unmute.
      });
  }

  return (
    <section aria-label="那年冬天 / That winter" className="max-w-4xl" data-lapland-public-cut="">
      <p className="travel-kicker text-xs">那年冬天 / That winter · {LAPLAND_SEASON_LABEL}</p>
      <div className="mx-auto mt-3 max-w-[22rem] sm:max-w-[24rem]">
        <div className="relative overflow-hidden rounded-[1.25rem]">
          <video
            autoPlay
            className="aspect-[9/16] w-full rounded-[1.25rem] bg-[color:var(--paper-soft)] object-contain"
            controls
            onVolumeChange={hideCueIfAudible}
            playsInline
            preload="metadata"
            ref={videoRef}
            src={LAPLAND_HERO_VIDEO_SRC}
          />
          {needsTapForSound ? (
            <button
              aria-label={LAPLAND_TAP_FOR_SOUND_LABEL}
              className="absolute inset-0 z-10 flex items-center justify-center bg-transparent"
              data-lapland-tap-for-sound=""
              onClick={handleTapForSound}
              type="button"
            >
              <span className="pointer-events-none rounded-full bg-black/70 px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
                {LAPLAND_TAP_FOR_SOUND_LABEL}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
