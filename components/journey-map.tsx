"use client";

import { useMemo, useState } from "react";
import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "@/lib/types";

type MapPin = {
  id: string;
  label: string;
  point: GeoPoint;
  note: string | null;
  kind: "base" | "place" | "photo";
  photo?: Photo;
  journal?: JournalEntry;
};

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

function isVisibleRoute(segment: TravelRouteSegment) {
  return segment.visibility !== "private";
}

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

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

function getBounds(points: GeoPoint[]) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPad = Math.max((maxLat - minLat) * 0.18, 0.03);
  const lngPad = Math.max((maxLng - minLng) * 0.18, 0.03);

  return {
    maxLat: maxLat + latPad,
    maxLng: maxLng + lngPad,
    minLat: minLat - latPad,
    minLng: minLng - lngPad,
  };
}

function project(point: GeoPoint, bounds: ReturnType<typeof getBounds>) {
  const x = ((point.longitude - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng, 0.0001)) * 100;
  const y = (1 - (point.latitude - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat, 0.0001)) * 100;

  return {
    x: Math.min(94, Math.max(6, x)),
    y: Math.min(88, Math.max(12, y)),
  };
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

export function JourneyMap({ center, city, country, journalEntries, photos, places, route, title }: JourneyMapProps) {
  const visibleRoute = route.filter(isVisibleRoute);
  const pins = useMemo<MapPin[]>(() => {
    const placePins = places
      .filter((place) => place.coordinates)
      .map((place) => {
        const linkedPhoto = photos.find((photo) => photo.coordinates && photo.coordinates.latitude === place.coordinates?.latitude && photo.coordinates.longitude === place.coordinates?.longitude);
        return {
          id: place.id,
          kind: "place" as const,
          label: place.name,
          note: place.notes,
          photo: linkedPhoto,
          point: place.coordinates as GeoPoint,
        };
      });
    const basePin = center
      ? [
          {
            id: "trip_base",
            kind: "base" as const,
            label: `${city}, ${country}`,
            note: "Trip base",
            point: center,
          },
        ]
      : [];

    return [...basePin, ...placePins];
  }, [center, city, country, photos, places]);
  const routePhotos = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const routeEntries = useMemo(() => new Map(journalEntries.map((entry) => [entry.id, entry])), [journalEntries]);
  const mapPoints = [
    ...pins.map((pin) => pin.point),
    ...visibleRoute.flatMap((segment) => [segment.from, segment.to]),
  ];
  const bounds = getBounds(mapPoints.length > 0 ? mapPoints : center ? [center] : [{ latitude: 0, longitude: 0 }]);
  const defaultSelection = pins[1]?.id ?? pins[0]?.id ?? visibleRoute[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelection);
  const selectedPin = pins.find((pin) => pin.id === selectedId);
  const selectedRoute = visibleRoute.find((segment) => segment.id === selectedId);
  const selectedRoutePhoto = selectedRoute?.linkedPhotoId ? routePhotos.get(selectedRoute.linkedPhotoId) : undefined;
  const selectedRouteEntry = selectedRoute?.linkedJournalEntryId ? routeEntries.get(selectedRoute.linkedJournalEntryId) : undefined;
  const selectedPhoto = selectedPin?.photo ?? selectedRoutePhoto;

  if (mapPoints.length === 0) {
    return (
      <section className="travel-soft-panel rounded-[1.75rem] p-4">
        <p className="travel-kicker text-xs">Journey map</p>
        <p className="travel-muted mt-2 text-sm leading-6">Map pins and route lines can be added from admin when this trip has coordinates.</p>
      </section>
    );
  }

  return (
    <section className="travel-soft-panel overflow-hidden rounded-[1.75rem]" aria-label={`${title} journey map`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/70 bg-white/55 px-4 py-3">
        <div>
          <p className="travel-kicker text-xs">Journey map</p>
          <h2 className="travel-hand mt-1 text-xl font-semibold text-[color:var(--ink)]">{city} route</h2>
        </div>
        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
          {pins.length} pins / {visibleRoute.length} routes
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[1fr_11rem]">
        <div className="relative min-h-[18rem] bg-[linear-gradient(135deg,#e0f2fe_0%,#fef3c7_48%,#dcfce7_100%)]">
          <div className="absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(255,255,255,.7)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.7)_1px,transparent_1px)] [background-size:22px_22px]" />
          <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
            {visibleRoute.map((segment, index) => {
              const from = project(segment.from, bounds);
              const to = project(segment.to, bounds);
              const isSelected = selectedId === segment.id;
              return (
                <path
                  className="cursor-pointer transition"
                  d={getRoutePath(from, to)}
                  fill="none"
                  key={segment.id}
                  onClick={() => setSelectedId(segment.id)}
                  stroke={isSelected ? "#0f766e" : "#2563eb"}
                  strokeDasharray={segment.transport === "flight" ? "3 3" : undefined}
                  strokeLinecap="round"
                  strokeWidth={isSelected ? 1.6 : 1.05}
                >
                  <title>{`${index + 1}. ${segment.fromLabel} to ${segment.toLabel}`}</title>
                </path>
              );
            })}
          </svg>
          {pins.map((pin, index) => {
            const position = project(pin.point, bounds);
            const selected = selectedId === pin.id;
            const tone =
              pin.kind === "base"
                ? "border-sky-100 bg-sky-700 text-white"
                : index % 2 === 0
                  ? "border-rose-100 bg-rose-600 text-white"
                  : "border-amber-100 bg-amber-500 text-white";
            return (
              <button
                className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 text-sm font-bold shadow-[0_12px_30px_rgba(15,23,42,.22)] transition hover:scale-105 ${tone} ${selected ? "ring-4 ring-white/80" : ""}`}
                key={pin.id}
                onClick={() => setSelectedId(pin.id)}
                style={{ left: `${position.x}%`, top: `${position.y}%` }}
                type="button"
              >
                {pin.kind === "base" ? "B" : index}
              </button>
            );
          })}
          <div className="absolute bottom-3 left-3 rounded-2xl border border-white/80 bg-white/85 px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
            Tap pins or route lines
          </div>
        </div>

        <aside className="border-t border-white/70 bg-white/75 p-3 lg:border-l lg:border-t-0">
          {selectedPin || selectedRoute ? (
            <div>
              <p className="travel-kicker text-[0.65rem]">{selectedRoute ? transportLabel(selectedRoute.transport) : selectedPin?.kind}</p>
              <h3 className="mt-1 text-sm font-semibold leading-5 text-[color:var(--ink)]">
                {selectedRoute ? `${selectedRoute.fromLabel} to ${selectedRoute.toLabel}` : selectedPin?.label}
              </h3>
              <p className="travel-muted mt-2 line-clamp-4 text-xs leading-5">{selectedRoute?.note ?? selectedPin?.note ?? "No note yet."}</p>
              {selectedPhoto && isRenderablePhoto(selectedPhoto) ? (
                <div className="mt-3 overflow-hidden rounded-xl bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={selectedPhoto.caption ?? selectedPhoto.originalFilename} className="h-20 w-full object-cover" src={selectedPhoto.storageKey} />
                </div>
              ) : null}
              {selectedRouteEntry ? <p className="mt-3 line-clamp-2 text-xs font-semibold text-teal-900">{selectedRouteEntry.title}</p> : null}
            </div>
          ) : (
            <p className="travel-muted text-xs leading-5">Choose a pin or route to see the record.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
