"use client";

import { useMemo, useState } from "react";
import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "@/lib/types";
import {
  buildJourneyItinerary,
  getFirstWordingBlock,
  getMapTiles,
  getScaleBar,
  getStopCardContent,
  getTileBounds,
  isRenderablePhoto,
  project,
  type ItineraryStop,
  type RegionalLeg,
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

const WINTER_STROKE = "#0f4f48";
const SIDE_STROKE = "#b65f44";
const FLIGHT_STROKE = "#64748b";

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

function getStraightPath(from: { x: number; y: number }, to: { x: number; y: number }) {
  return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
}

function ArrivalLocator({ cities }: { cities: { id: string; label: string; shortLabel: string }[] }) {
  return (
    <div className="border-b border-[color:var(--line)] bg-white/55 px-4 py-2.5" data-arrival-locator>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="travel-kicker text-[0.62rem]">How we arrived</p>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-[0.72rem] font-semibold text-slate-600">
          {cities.map((city, index) => (
            <span className="flex items-center gap-1.5" key={city.id}>
              {index > 0 ? (
                <svg aria-hidden="true" className="h-3 w-7 shrink-0 text-slate-400" viewBox="0 0 32 12">
                  <path d="M1 6h30" fill="none" stroke={FLIGHT_STROKE} strokeDasharray="2 2.5" strokeLinecap="round" strokeWidth="1.4" />
                </svg>
              ) : null}
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                <span className="text-[0.62rem] tracking-wide text-slate-500">{city.shortLabel}</span>
                <span className="text-slate-800">{city.label}</span>
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function RegionalMap({
  city,
  legs,
  onSelect,
  selectedId,
  stops,
}: {
  city: string;
  legs: RegionalLeg[];
  onSelect: (id: string) => void;
  selectedId: string | null;
  stops: ItineraryStop[];
}) {
  const bounds = getTileBounds(
    stops.length > 0 ? stops.map((stop) => stop.point) : [{ latitude: 0, longitude: 0 }],
    "regional",
  );
  const mapTiles = getMapTiles(bounds);
  const scaleBar = getScaleBar(bounds, stops[0]?.point.latitude ?? 66.5);

  return (
    <div
      className="relative min-h-[22rem] overflow-hidden rounded-2xl bg-[#d7e3dc] sm:min-h-[26rem] lg:min-h-[32rem]"
      data-map-frame="regional"
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#e7eee8_0%,#d5e4ea_100%)]" />
      {mapTiles.map((tile) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="absolute max-w-none select-none object-cover opacity-55 grayscale-[42%] saturate-[0.42] contrast-[0.9]"
          draggable={false}
          key={tile.key}
          loading="lazy"
          src={tile.src}
          style={tile.style}
        />
      ))}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(251,250,246,.34),rgba(255,255,252,.22)_46%,rgba(247,242,232,.38))]" />
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
        {legs.map((leg) => {
          const from = project(leg.from, bounds);
          const to = project(leg.to, bounds);
          const path = getStraightPath(from, to);
          return (
            <g key={leg.id}>
              <path d={path} fill="none" stroke="rgba(255,255,255,.88)" strokeLinecap="round" strokeWidth={2.4} />
              <path
                d={path}
                fill="none"
                stroke={leg.kind === "side" ? SIDE_STROKE : WINTER_STROKE}
                strokeDasharray={leg.style === "dotted" ? "1.8 1.6" : undefined}
                strokeLinecap="round"
                strokeWidth={leg.kind === "side" ? 1.05 : 1.35}
              />
            </g>
          );
        })}
      </svg>
      {stops.map((stop) => {
        const position = project(stop.point, bounds);
        const selected = selectedId === stop.id;
        const tone = stop.leg === "side" ? "bg-[#b65f44] border-[#f3d6c8]" : "bg-[#0f4f48] border-[#d7ebe6]";
        return (
          <button
            aria-label={`Stop ${stop.number}: ${stop.listLabel}`}
            aria-pressed={selected}
            className={`absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 place-items-center transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
              selected ? "z-40" : ""
            }`}
            data-map-pin={stop.number}
            key={stop.id}
            onClick={() => onSelect(stop.id)}
            style={{ left: `${position.x}%`, top: `${position.y}%`, zIndex: selected ? 35 : 12 + stop.number }}
            title={stop.listLabel}
            type="button"
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-full border-2 text-[0.72rem] font-bold text-white shadow-[0_10px_22px_rgba(15,23,42,.28)] ${tone} ${
                selected ? "ring-4 ring-white/85" : ""
              }`}
            >
              {stop.number}
            </span>
          </button>
        );
      })}
      <div className="absolute left-3 top-3 rounded-full border border-white/80 bg-white/80 px-2.5 py-1 text-[0.62rem] font-semibold tracking-[0.14em] text-slate-600 shadow-sm">
        {city.toUpperCase()} · LAPLAND
      </div>
      <div className="absolute right-3 top-3 grid place-items-center rounded-md border border-white/80 bg-white/80 px-1.5 py-1 text-[0.58rem] font-bold text-slate-700 shadow-sm">
        <span aria-hidden="true" className="text-[0.7rem] leading-none">
          ▲
        </span>
        <span>N</span>
      </div>
      <div className="absolute bottom-3 left-3 space-y-1.5 rounded-xl border border-white/80 bg-white/82 px-2.5 py-2 text-[0.62rem] font-semibold text-slate-700 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-6 rounded-full bg-[#0f4f48]" />
          Winter route
        </div>
        <div className="flex items-center gap-2">
          <span className="h-[2px] w-6 rounded-full bg-[repeating-linear-gradient(90deg,#b65f44_0_4px,transparent_4px_7px)]" />
          Side leg
        </div>
        <div className="flex items-center gap-2 pt-1">
          <span className="block h-[3px] rounded-full bg-slate-800" style={{ width: `${Math.min(scaleBar.widthPercent, 28) * 2.1}px` }} />
          <span>{scaleBar.label}</span>
        </div>
      </div>
      <a
        className="absolute bottom-3 right-3 rounded-full bg-white/85 px-2 py-1 text-[0.58rem] font-semibold text-slate-600 shadow-sm"
        href="https://www.openstreetmap.org/copyright"
        rel="noreferrer"
        target="_blank"
      >
        OpenStreetMap
      </a>
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
          <p className="travel-kicker text-xs">Journey map</p>
          <h2 className="travel-hand mt-1 text-xl font-semibold text-[color:var(--ink)]">
            {city}, {country}
          </h2>
        </div>
        <span className="rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-950">
          Regional itinerary
        </span>
      </div>

      {itinerary.arrival ? <ArrivalLocator cities={itinerary.arrival} /> : null}

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

        <RegionalMap city={city} legs={itinerary.regionalLegs} onSelect={setSelectedId} selectedId={selectedStop?.id ?? null} stops={itinerary.regionalStops} />
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
