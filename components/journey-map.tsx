"use client";

import { useMemo, useState } from "react";
import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "@/lib/types";
import {
  buildJourneyItinerary,
  buildPosterLayout,
  getFirstWordingBlock,
  getStopCardContent,
  isLaplandPosterCity,
  isRenderablePhoto,
  LAPLAND_POSTER,
  STREET_BASEMAP,
  type PosterPin,
  type StopIcon,
} from "@/lib/journey-map-model";

type JourneyMapProps = {
  city: string;
  country: string;
  center: GeoPoint | null;
  journalEntries: JournalEntry[];
  photos: Photo[];
  places: Place[];
  route: TravelRouteSegment[];
  title: string;
};

function StopGlyph({ icon }: { icon: StopIcon }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 1.6,
  };

  if (icon === "plane") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <path d="M2 8.5h12M4 8.5l2.2-3.2h2.2L6.8 8.5l1.6 3.6H6.2L4.6 8.5H2Z" {...common} />
      </svg>
    );
  }

  if (icon === "village") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <path d="M3 13V8l5-4 5 4v5H3Z" {...common} />
      </svg>
    );
  }

  if (icon === "circle") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <circle cx="8" cy="8" r="4.2" {...common} />
      </svg>
    );
  }

  if (icon === "sled") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <path d="M3 11.5h10M4.5 11.5V8h7v3.5M4 13c.8 0 1.2-.8 2-.8s1.2.8 2 .8 1.2-.8 2-.8 1.2.8 2 .8" {...common} />
      </svg>
    );
  }

  if (icon === "fire") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <path d="M8 3c1.4 2-1 3.2-.4 5 1.2 0 2.8-1.4 3.6.2C12 10.4 10.2 13 8 13s-4-2.4-3.2-4.8C5.6 6.4 6.8 5.6 8 3Z" {...common} />
      </svg>
    );
  }

  if (icon === "cabin") {
    return (
      <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
        <path d="M3 8.5 8 4l5 4.5V13H3V8.5Z" {...common} />
        <path d="M7 13V9.5h2V13" {...common} />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 16 16">
      <circle cx="8" cy="7" r="2.4" {...common} />
      <path d="M8 9.4 6.4 13h3.2L8 9.4Z" {...common} />
    </svg>
  );
}

function QuietArrival({ cities }: { cities: { id: string; label: string; shortLabel: string }[] }) {
  const labels = cities.map((city) => city.label).join(" · ");

  return (
    <p className="mt-1 text-[0.7rem] leading-5 text-slate-500" data-arrival-locator data-longhaul-label>
      via {labels}
    </p>
  );
}

function RegionalMap({
  city,
  onSelect,
  pins,
  selectedId,
}: {
  city: string;
  onSelect: (id: string) => void;
  pins: PosterPin[];
  selectedId: string | null;
}) {
  const usePoster = isLaplandPosterCity(city);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#e8f0e4]" data-map-frame="regional" data-map-poster={usePoster ? LAPLAND_POSTER.src : undefined}>
      {usePoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt={LAPLAND_POSTER.alt}
          className="block h-auto w-full select-none"
          data-map-poster-image
          draggable={false}
          src={LAPLAND_POSTER.src}
        />
      ) : (
        <div className="min-h-[22rem] bg-[#e8f0e4] sm:min-h-[26rem] lg:min-h-[32rem]" />
      )}
      {pins.map((pin) => {
        const selected = selectedId === pin.id;
        return (
          <button
            aria-label={`Stop ${pin.number}: ${pin.label}`}
            aria-pressed={selected}
            className={`absolute min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 rounded-full bg-transparent text-transparent transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
              selected ? "z-40 ring-4 ring-white/90 ring-offset-2 ring-offset-teal-800/30" : ""
            }`}
            data-map-pin={pin.number}
            key={pin.id}
            onClick={() => onSelect(pin.id)}
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            title={pin.label}
            type="button"
          >
            {pin.number}
          </button>
        );
      })}
      <p className="sr-only">Map credit: {STREET_BASEMAP.attribution}</p>
    </div>
  );
}

export function JourneyMap({ center, city, country, journalEntries, photos, places, route, title }: JourneyMapProps) {
  const itinerary = useMemo(
    () => buildJourneyItinerary({ center, city, journalEntries, photos, places, route }),
    [center, city, journalEntries, photos, places, route],
  );
  const defaultSelection =
    itinerary.regionalStops.find((stop) => stop.linkedPhotoId)?.id ?? itinerary.regionalStops[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelection);
  const selectedStop = itinerary.regionalStops.find((stop) => stop.id === selectedId) ?? itinerary.regionalStops[0] ?? null;
  const posterLayout = useMemo(() => buildPosterLayout(itinerary, city), [city, itinerary]);
  const selectedCard = getStopCardContent({
    journalEntries,
    photos,
    stop: selectedStop,
  });

  if (itinerary.regionalStops.length === 0 && itinerary.regionalPoints.length === 0) {
    return (
      <section className="travel-soft-panel rounded-[1.75rem] p-4">
        <p className="travel-kicker text-xs">Journey map</p>
        <p className="travel-muted mt-2 text-sm leading-6">Map pins and route lines can be added from admin when this trip has coordinates.</p>
      </section>
    );
  }

  return (
    <section className="travel-soft-panel overflow-hidden rounded-[1.75rem]" aria-label={`${title} journey map`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/70 bg-white/60 px-4 py-3">
        <div>
          <p className="travel-kicker text-xs">Journey picture</p>
          <h2 className="travel-hand mt-1 text-xl font-semibold text-[color:var(--ink)]">
            {city}, {country}
          </h2>
          {itinerary.arrival ? <QuietArrival cities={itinerary.arrival} /> : null}
        </div>
        <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-950">
          At a glance
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(15rem,18.5rem)_minmax(0,1fr)] lg:items-stretch">
        <ol className="flex flex-col gap-1.5" data-stop-list>
          {itinerary.regionalStops.map((stop) => {
            const selected = selectedStop?.id === stop.id;
            return (
              <li key={stop.id}>
                <button
                  aria-label={`${stop.number}. ${stop.listLabel}`}
                  aria-pressed={selected}
                  className={`grid min-h-11 w-full grid-cols-[2rem_minmax(0,1fr)_1.25rem] items-center gap-2 rounded-2xl border px-2.5 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                    selected
                      ? "border-teal-200 bg-teal-50 text-teal-950 shadow-sm"
                      : "border-transparent bg-white/70 text-slate-700 hover:border-sky-100 hover:bg-sky-50"
                  }`}
                  data-stop-button={stop.number}
                  onClick={() => setSelectedId(stop.id)}
                  type="button"
                >
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full text-[0.72rem] font-bold text-white ${
                      stop.leg === "side" ? "bg-[#b65f44]" : "bg-[#0f4f48]"
                    }`}
                  >
                    {stop.number}
                  </span>
                  <span className="min-w-0">
                    {stop.dateLabel ? <span className="mr-1.5 whitespace-nowrap text-[0.62rem] font-bold tracking-wide text-teal-800">{stop.dateLabel}</span> : null}
                    <span className="block truncate text-[0.8rem] font-semibold leading-5">{stop.listLabel}</span>
                  </span>
                  <span className={selected ? "text-teal-800" : "text-slate-400"}>
                    <StopGlyph icon={stop.icon} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <RegionalMap city={city} onSelect={setSelectedId} pins={posterLayout.pins} selectedId={selectedStop?.id ?? null} />
      </div>

      {selectedCard ? (
        <article className="grid gap-3 border-t border-white/70 bg-white/55 p-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:p-4" data-stop-card>
          {selectedCard.photo && isRenderablePhoto(selectedCard.photo) ? (
            <div className="overflow-hidden rounded-xl bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={selectedCard.caption ?? selectedCard.title} className="h-40 w-full object-cover sm:h-full" src={selectedCard.photo.storageKey} />
            </div>
          ) : (
            <div className="grid min-h-[6.5rem] place-items-center rounded-xl bg-[color:var(--paper-soft)] px-4 text-center text-sm text-[color:var(--muted)]">
              No photo for this stop
            </div>
          )}
          <div className="min-w-0">
            <p className="travel-kicker text-[0.65rem]">{selectedStop ? `Stop ${selectedStop.number}` : "Stop"}</p>
            <h3 className="mt-1 text-base font-semibold leading-6 text-[color:var(--ink)]" data-stop-title>
              {selectedCard.title}
            </h3>
            <p className="travel-muted mt-2 text-sm leading-6" data-stop-wording>
              {getFirstWordingBlock(selectedCard.wording)}
            </p>
            {selectedCard.caption ? <p className="mt-2 text-xs leading-5 text-teal-900">{selectedCard.caption}</p> : null}
          </div>
        </article>
      ) : (
        <p className="travel-muted px-4 pb-4 text-sm leading-6">Choose a numbered stop to see the photo and note.</p>
      )}
    </section>
  );
}
