import {
  LAPLAND_HERO_VIDEO_SRC,
  LAPLAND_SEASON_LABEL,
} from "@/lib/lapland-storefront-copy";

export function LaplandPublicCut() {
  return (
    <section aria-label="那年冬天 / That winter" className="max-w-4xl" data-lapland-public-cut="">
      <p className="travel-kicker text-xs">那年冬天 / That winter · {LAPLAND_SEASON_LABEL}</p>
      <div className="mx-auto mt-3 max-w-[22rem] sm:max-w-[24rem]">
        <video
          autoPlay
          className="aspect-[9/16] w-full rounded-[1.25rem] bg-[color:var(--paper-soft)] object-contain"
          controls
          muted
          playsInline
          preload="metadata"
          src={LAPLAND_HERO_VIDEO_SRC}
        />
      </div>
    </section>
  );
}
