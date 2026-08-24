"use client";

import { useMemo, useState } from "react";
import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "@/lib/types";
import {
  buildScalePins,
  getFirstWordingBlock,
  getMapTiles,
  getRouteStops,
  getStopCardContent,
  getTileBounds,
  isRenderablePhoto,
  isVisibleRoute,
  partitionJourneyScales,
  pointKey,
  project,
  type MapPin,
  type MapScale,
  type ScaleSlice,
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

type PositionedPin = MapPin & {
  offsetX: number;
  offsetY: number;
  position: { x: number; y: number };
  spreadIndex: number;
  spreadTotal: number;
};

function transportLabel(transport: TravelRouteSegment["transport"]) {
  const labels: Record<TravelRouteSegment["transport"], string> = {
    boat: "Boat",
    car: "Drive",
    flight: "Flight",
    other: "Move",
    train: "Train",
    walk: "Walk",
  };

  return labels[transport];
}

function getRoutePath(from: ReturnType<typeof project>, to: ReturnType<typeof project>) {
  if (Math.abs(from.x - to.x) < 0.5 && Math.abs(from.y - to.y) < 0.5) {
    return `M ${from.x} ${from.y} m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`;
  }

  const curve = Math.min(12, Math.max(5, Math.abs(to.x - from.x) * 0.18 + Math.abs(to.y - from.y) * 0.08));
  const controlX = (from.x + to.x) / 2;
  const controlY = Math.min(from.y, to.y) - curve;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

function spreadOverlappingPins<T extends { point: GeoPoint }>(pins: T[]) {
  const counts = new Map<string, number>();

  return pins.map((pin) => {
    const key = pointKey(pin.point);
    const index = counts.get(key) ?? 0;
    counts.set(key, index + 1);
    const total = pins.filter((item) => pointKey(item.point) === key).length;

    return {
      ...pin,
      spreadIndex: index,
      spreadTotal: total,
    };
  });
}

function getPositionedPins(pins: MapPin[], bounds: ReturnType<typeof getTileBounds>): PositionedPin[] {
  const spreadPins = spreadOverlappingPins(pins);
  const projectedPins = spreadPins.map((pin) => ({
    ...pin,
    offsetX: 0,
    offsetY: 0,
    position: project(pin.point, bounds),
  }));
  const clusters: typeof projectedPins[] = [];

  projectedPins.forEach((pin) => {
    const cluster = clusters.find((items) => {
      const anchor = items[0];
      return Math.hypot(anchor.position.x - pin.position.x, anchor.position.y - pin.position.y) < 8;
    });

    if (cluster) {
      cluster.push(pin);
      return;
    }

    clusters.push([pin]);
  });

  clusters.forEach((cluster) => {
    if (cluster.length < 2) {
      return;
    }

    const radius = Math.min(34, 16 + cluster.length * 4);
    const sortedCluster = cluster.sort((first, second) => (first.displayNumber ?? 99) - (second.displayNumber ?? 99));
    sortedCluster.forEach((pin, index) => {
      const angle = (-115 + (230 / Math.max(sortedCluster.length - 1, 1)) * index) * (Math.PI / 180);
      pin.offsetX = Math.cos(angle) * radius;
      pin.offsetY = Math.sin(angle) * radius;
    });
  });

  return projectedPins;
}

function getRouteStopLabel(label: string) {
  return label.replace(/\s+International(?=\s+Airport$)/i, "").replace(/\s+Line$/i, "");
}

function scaleCopy(scale: MapScale, city: string) {
  if (scale === "overview") {
    return { kicker: "Overview", title: "Long-haul flights" };
  }

  if (scale === "detail") {
    return { kicker: "Local", title: `${city} area` };
  }

  return { kicker: "Journey map", title: `${city} route` };
}

function MapFrame({
  city,
  heightClass,
  onSelect,
  pins,
  selectedId,
  slice,
}: {
  city: string;
  heightClass: string;
  onSelect: (id: string) => void;
  pins: MapPin[];
  selectedId: string | null;
  slice: ScaleSlice;
}) {
  const bounds = getTileBounds(slice.points.length > 0 ? slice.points : [{ latitude: 0, longitude: 0 }], slice.scale);
  const mapTiles = getMapTiles(bounds);
  const copy = scaleCopy(slice.scale, city);
  const positionedPins = getPositionedPins(pins, bounds);

  return (
    <div className="min-w-0" data-map-scale={slice.scale}>
      <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
        <div>
          <p className="travel-kicker text-[0.62rem]">{copy.kicker}</p>
          <p className="text-sm font-semibold text-[color:var(--ink)]">{copy.title}</p>
        </div>
        <span className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[0.62rem] font-semibold text-sky-900">
          {slice.scale === "overview" ? "Flight scale" : "Local scale"}
        </span>
      </div>
      <div className={`relative overflow-hidden rounded-2xl bg-[#dbeafe] ${heightClass}`}>
        <div className="absolute inset-0 bg-[linear-gradient(135deg,#dbeafe_0%,#dcfce7_100%)]" />
        {mapTiles.map((tile) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="absolute max-w-none select-none object-cover"
            draggable={false}
            key={tile.key}
            loading="lazy"
            src={tile.src}
            style={tile.style}
          />
        ))}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,.12),rgba(255,255,255,.28))]" />
        <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
          {slice.route.map((segment) => {
            const from = project(segment.from, bounds);
            const to = project(segment.to, bounds);
            const isSelected = selectedId === segment.id;
            return (
              <path
                className="cursor-pointer transition"
                d={getRoutePath(from, to)}
                fill="none"
                key={segment.id}
                onClick={() => onSelect(segment.id)}
                stroke="rgba(255,255,255,.92)"
                strokeLinecap="round"
                strokeWidth={isSelected ? 2.6 : 2}
              />
            );
          })}
          {slice.route.map((segment, index) => {
            const from = project(segment.from, bounds);
            const to = project(segment.to, bounds);
            const isSelected = selectedId === segment.id;
            return (
              <path
                className="cursor-pointer transition"
                d={getRoutePath(from, to)}
                fill="none"
                key={`${segment.id}-line`}
                onClick={() => onSelect(segment.id)}
                stroke={isSelected ? "#dc2626" : "#2563eb"}
                strokeDasharray={segment.transport === "flight" ? "3 3" : undefined}
                strokeLinecap="round"
                strokeWidth={isSelected ? 1.65 : 1.15}
              >
                <title>{`${index + 1}. ${segment.fromLabel} to ${segment.toLabel}`}</title>
              </path>
            );
          })}
        </svg>
        {positionedPins.map((pin) => {
          const selected = selectedId === pin.id;
          const tone =
            pin.kind === "base"
              ? "border-sky-100 bg-sky-700 text-white"
              : (pin.displayNumber ?? 0) % 2 === 0
                ? "border-rose-100 bg-rose-600 text-white"
                : "border-amber-100 bg-amber-500 text-white";
          return (
            <button
              aria-label={`Stop ${pin.displayNumber}: ${pin.label}`}
              aria-pressed={selected}
              className={`absolute grid min-h-11 min-w-11 -translate-x-1/2 -translate-y-full place-items-center transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${selected ? "z-40" : ""}`}
              key={pin.id}
              onClick={() => onSelect(pin.id)}
              style={{
                left: `calc(${pin.position.x}% + ${pin.offsetX}px)`,
                top: `calc(${pin.position.y}% + ${pin.offsetY}px)`,
                zIndex: selected ? 35 : 12 + (pin.displayNumber ?? 0),
              }}
              title={pin.label}
              type="button"
            >
              <span
                className={`grid h-8 w-8 rotate-45 place-items-center rounded-[50%_50%_50%_0] border-2 text-[0.7rem] font-bold shadow-[0_10px_24px_rgba(15,23,42,.25)] ${tone} ${
                  selected ? "ring-4 ring-white/80" : ""
                }`}
              >
                <span className="-rotate-45">{pin.displayNumber}</span>
              </span>
            </button>
          );
        })}
        <a
          className="absolute bottom-2 right-2 rounded-full bg-white/85 px-2 py-1 text-[0.62rem] font-semibold text-slate-600 shadow-sm"
          href="https://www.openstreetmap.org/copyright"
          rel="noreferrer"
          target="_blank"
        >
          OpenStreetMap
        </a>
      </div>
    </div>
  );
}

function NumberedStopButtons({
  label,
  onSelect,
  pins,
  selectedId,
}: {
  label: string;
  onSelect: (id: string) => void;
  pins: MapPin[];
  selectedId: string | null;
}) {
  if (pins.length === 0) {
    return null;
  }

  return (
    <div>
      <p className="travel-kicker mb-2 text-[0.62rem]">{label}</p>
      <div className="flex flex-wrap gap-2">
        {pins.map((pin) => {
          const selected = selectedId === pin.id;
          return (
            <button
              aria-label={`${pin.displayNumber}. ${pin.label}`}
              aria-pressed={selected}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                selected
                  ? "border-red-200 bg-red-50 text-red-700 shadow-sm"
                  : "border-[color:var(--line)] bg-white/80 text-slate-700 hover:border-sky-100 hover:bg-sky-50"
              }`}
              key={`${label}-${pin.id}`}
              onClick={() => onSelect(pin.id)}
              title={pin.label}
              type="button"
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[0.7rem] ${
                  selected ? "bg-red-600 text-white" : "bg-slate-900 text-white"
                }`}
              >
                {pin.displayNumber}
              </span>
              <span className="max-w-[9rem] truncate">{getRouteStopLabel(pin.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function JourneyMap({ center, city, country, journalEntries, photos, places, route, title }: JourneyMapProps) {
  const scales = useMemo(() => partitionJourneyScales({ center, places, route }), [center, places, route]);
  const frames = useMemo(() => [scales.overview, scales.detail, scales.single].filter((slice): slice is ScaleSlice => Boolean(slice)), [scales]);
  const pinSets = useMemo(
    () =>
      frames.map((slice) =>
        buildScalePins({
          center,
          city,
          country,
          journalEntries,
          photos,
          places: slice.places,
          routeStops: getRouteStops(slice.route),
          showBase: slice.showBase,
        }),
      ),
    [center, city, country, frames, journalEntries, photos],
  );
  const allPins = useMemo(() => {
    const byId = new Map<string, MapPin>();
    pinSets.flat().forEach((pin) => {
      if (!byId.has(pin.id)) {
        byId.set(pin.id, pin);
      }
    });
    return [...byId.values()];
  }, [pinSets]);
  const defaultSelection =
    (pinSets[1] ?? pinSets[0] ?? []).find((pin) => pin.linkedPhotoId || pin.photo)?.id ??
    pinSets[1]?.[0]?.id ??
    pinSets[0]?.[0]?.id ??
    route.find(isVisibleRoute)?.id ??
    null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelection);
  const selectedPin = allPins.find((pin) => pin.id === selectedId);
  const selectedRoute = route.find((segment) => segment.id === selectedId);
  const selectedCard = getStopCardContent({
    journalEntries,
    photos,
    pin: selectedPin,
    route: selectedRoute,
  });

  if (frames.length === 0 || frames.every((slice) => slice.points.length === 0)) {
    return (
      <section className="travel-soft-panel rounded-[1.75rem] p-4">
        <p className="travel-kicker text-xs">Journey map</p>
        <p className="travel-muted mt-2 text-sm leading-6">Map pins and route lines can be added from admin when this trip has coordinates.</p>
      </section>
    );
  }

  const overviewPins = pinSets[frames.findIndex((slice) => slice.scale === "overview")] ?? [];
  const detailPins = pinSets[frames.findIndex((slice) => slice.scale === "detail" || slice.scale === "single")] ?? pinSets[0] ?? [];

  return (
    <section className="travel-soft-panel overflow-hidden rounded-[1.75rem]" aria-label={`${title} journey map`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/70 bg-white/60 px-4 py-3">
        <div>
          <p className="travel-kicker text-xs">Journey map</p>
          <h2 className="travel-hand mt-1 text-xl font-semibold text-[color:var(--ink)]">{city} route</h2>
        </div>
        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
          {frames.length > 1 ? "Two scales" : `${allPins.length} pins`}
        </span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4">
        <div className={`grid gap-4 ${frames.length > 1 ? "lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]" : ""}`}>
          {frames.map((slice, index) => (
            <MapFrame
              city={city}
              heightClass={
                slice.scale === "overview"
                  ? "min-h-[9rem] h-[9.5rem] sm:min-h-[10rem] sm:h-[10.5rem]"
                  : "min-h-[16rem] h-[16.5rem] sm:min-h-[20rem] sm:h-[20.5rem]"
              }
              key={slice.scale}
              onSelect={setSelectedId}
              pins={pinSets[index] ?? []}
              selectedId={selectedId}
              slice={slice}
            />
          ))}
        </div>

        {overviewPins.length > 0 && frames.some((slice) => slice.scale === "overview") ? (
          <NumberedStopButtons label="Overview stops" onSelect={setSelectedId} pins={overviewPins} selectedId={selectedId} />
        ) : null}
        <NumberedStopButtons
          label={frames.some((slice) => slice.scale === "detail") ? "Local stops" : "Route stops"}
          onSelect={setSelectedId}
          pins={detailPins}
          selectedId={selectedId}
        />

        {selectedCard ? (
          <article className="grid gap-3 rounded-2xl border border-white/70 bg-white/70 p-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:p-4" data-stop-card>
            {selectedCard.photo && isRenderablePhoto(selectedCard.photo) ? (
              <div className="overflow-hidden rounded-xl bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={selectedCard.caption ?? selectedCard.title}
                  className="h-40 w-full object-cover sm:h-full"
                  src={selectedCard.photo.storageKey}
                />
              </div>
            ) : (
              <div className="grid min-h-[6.5rem] place-items-center rounded-xl bg-[color:var(--paper-soft)] px-4 text-center text-sm text-[color:var(--muted)]">
                No photo for this stop
              </div>
            )}
            <div className="min-w-0">
              <p className="travel-kicker text-[0.65rem]">{selectedRoute ? transportLabel(selectedRoute.transport) : selectedPin?.kind ?? "stop"}</p>
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
          <p className="travel-muted text-sm leading-6">Choose a numbered stop to see the photo and note.</p>
        )}
      </div>
    </section>
  );
}
