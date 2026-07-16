"use client";

import { useMemo, useState } from "react";
import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "@/lib/types";

type MapPin = {
  id: string;
  label: string;
  point: GeoPoint;
  note: string | null;
  kind: "base" | "place" | "photo";
  linkedJournalEntryId?: string | null;
  linkedPhotoId?: string | null;
  routeOrder?: number;
  photo?: Photo;
  journal?: JournalEntry;
};

type RouteStop = {
  label: string;
  linkedJournalEntryId: string | null;
  linkedPhotoId: string | null;
  order: number;
  point: GeoPoint;
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

function getGeoBounds(points: GeoPoint[]) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  return {
    maxLat: Math.max(...latitudes),
    maxLng: Math.max(...longitudes),
    minLat: Math.min(...latitudes),
    minLng: Math.min(...longitudes),
  };
}

function chooseZoom(points: GeoPoint[]) {
  const bounds = getGeoBounds(points);
  const span = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);

  if (span > 8) {
    return 5;
  }

  if (span > 3) {
    return 6;
  }

  if (span > 1.2) {
    return 7;
  }

  if (span > 0.45) {
    return 9;
  }

  return 11;
}

function longitudeToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const radians = (latitude * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * 2 ** zoom;
}

function getTileBounds(points: GeoPoint[]) {
  const zoom = chooseZoom(points);
  const xs = points.map((point) => longitudeToTileX(point.longitude, zoom));
  const ys = points.map((point) => latitudeToTileY(point.latitude, zoom));
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  const pad = Math.max(0.35, Math.max(xSpan, ySpan) * 0.18);

  return {
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    zoom,
  };
}

function getMapTiles(bounds: ReturnType<typeof getTileBounds>) {
  const tileCount = 2 ** bounds.zoom;
  const minX = Math.floor(bounds.minX);
  const maxX = Math.floor(bounds.maxX);
  const minY = Math.max(0, Math.floor(bounds.minY));
  const maxY = Math.min(tileCount - 1, Math.floor(bounds.maxY));

  return Array.from({ length: maxY - minY + 1 }).flatMap((_, rowIndex) =>
    Array.from({ length: maxX - minX + 1 }).map((__, columnIndex) => {
      const x = minX + columnIndex;
      const y = minY + rowIndex;
      const wrappedX = ((x % tileCount) + tileCount) % tileCount;
      return {
        key: `${bounds.zoom}-${wrappedX}-${y}`,
        src: `https://tile.openstreetmap.org/${bounds.zoom}/${wrappedX}/${y}.png`,
        style: {
          height: `${(1 / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100}%`,
          left: `${((x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100}%`,
          top: `${((y - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100}%`,
          width: `${(1 / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100}%`,
        },
      };
    }),
  );
}

function project(point: GeoPoint, bounds: ReturnType<typeof getTileBounds>) {
  const x = ((longitudeToTileX(point.longitude, bounds.zoom) - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100;
  const y = ((latitudeToTileY(point.latitude, bounds.zoom) - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100;

  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(92, Math.max(8, y)),
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

function pointKey(point: GeoPoint) {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
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

function getPositionedPins<T extends MapPin>(pins: (T & { spreadIndex: number; spreadTotal: number })[], bounds: ReturnType<typeof getTileBounds>) {
  const projectedPins = pins.map((pin) => ({
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
    const sortedCluster = cluster.sort((first, second) => (first.routeOrder ?? 99) - (second.routeOrder ?? 99));
    sortedCluster.forEach((pin, index) => {
      const angle = (-115 + (230 / Math.max(sortedCluster.length - 1, 1)) * index) * (Math.PI / 180);
      pin.offsetX = Math.cos(angle) * radius;
      pin.offsetY = Math.sin(angle) * radius;
    });
  });

  return projectedPins;
}

function getRouteStopLabel(label: string) {
  return label.replace(/\s+(International\s+)?Airport$/i, "").replace(/\s+Line$/i, "");
}

function getRouteStops(route: TravelRouteSegment[]) {
  const stops: RouteStop[] = [];
  const seenLabels = new Set<string>();

  route.forEach((segment) => {
    [
      { label: segment.fromLabel, linkedJournalEntryId: null, linkedPhotoId: null, point: segment.from },
      {
        label: segment.toLabel,
        linkedJournalEntryId: segment.linkedJournalEntryId,
        linkedPhotoId: segment.linkedPhotoId,
        point: segment.to,
      },
    ].forEach((stop) => {
      const normalizedLabel = stop.label.toLowerCase();
      if (!seenLabels.has(normalizedLabel)) {
        stops.push({ ...stop, order: stops.length + 1 });
        seenLabels.add(normalizedLabel);
        return;
      }

      const existingStop = stops.find((item) => item.label.toLowerCase() === normalizedLabel);
      if (existingStop && !existingStop.linkedPhotoId && stop.linkedPhotoId) {
        existingStop.linkedJournalEntryId = stop.linkedJournalEntryId;
        existingStop.linkedPhotoId = stop.linkedPhotoId;
      }
    });
  });

  return stops;
}

function findRouteStopForPin(pinLabel: string, point: GeoPoint, routeStops: RouteStop[]) {
  const normalizedPinLabel = pinLabel.toLowerCase();
  const exactMatch = routeStops.find((stop) => stop.label.toLowerCase() === normalizedPinLabel);
  if (exactMatch) {
    return exactMatch;
  }

  const labelMatch = routeStops.find((stop) => {
    const normalizedStopLabel = stop.label.toLowerCase();
    return normalizedStopLabel.includes(normalizedPinLabel) || normalizedPinLabel.includes(normalizedStopLabel);
  });
  if (labelMatch) {
    return labelMatch;
  }

  return routeStops.find((stop) => pointKey(stop.point) === pointKey(point));
}

export function JourneyMap({ center, city, country, journalEntries, photos, places, route, title }: JourneyMapProps) {
  const visibleRoute = route.filter(isVisibleRoute);
  const orderedRouteStops = useMemo(() => getRouteStops(visibleRoute), [visibleRoute]);
  const pins = useMemo(() => {
    const placePins = places
      .filter((place) => place.coordinates)
      .map((place) => {
        const linkedPhoto = photos.find((photo) => photo.coordinates && photo.coordinates.latitude === place.coordinates?.latitude && photo.coordinates.longitude === place.coordinates?.longitude);
        const routeStop = place.coordinates ? findRouteStopForPin(place.name, place.coordinates, orderedRouteStops) : undefined;
        return {
          id: place.id,
          kind: "place" as const,
          label: place.name,
          linkedJournalEntryId: routeStop?.linkedJournalEntryId,
          linkedPhotoId: routeStop?.linkedPhotoId,
          note: place.notes,
          photo: linkedPhoto,
          point: place.coordinates as GeoPoint,
          routeOrder: routeStop?.order,
        };
      })
      .sort((first, second) => {
        if (first.routeOrder && second.routeOrder) {
          return first.routeOrder - second.routeOrder;
        }

        if (first.routeOrder) {
          return -1;
        }

        if (second.routeOrder) {
          return 1;
        }

        return first.label.localeCompare(second.label);
      });
    const basePin: MapPin[] = center
      ? [
          {
            id: "trip_base",
            kind: "base" as const,
            label: `${city}, ${country}`,
            linkedJournalEntryId: findRouteStopForPin(city, center, orderedRouteStops)?.linkedJournalEntryId,
            linkedPhotoId: findRouteStopForPin(city, center, orderedRouteStops)?.linkedPhotoId,
            note: "Trip base",
            point: center,
            routeOrder: findRouteStopForPin(city, center, orderedRouteStops)?.order,
          },
        ]
      : [];

    return spreadOverlappingPins([...basePin, ...placePins]);
  }, [center, city, country, orderedRouteStops, photos, places]);
  const routePhotos = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const routeEntries = useMemo(() => new Map(journalEntries.map((entry) => [entry.id, entry])), [journalEntries]);
  const mapPoints = [
    ...pins.map((pin) => pin.point),
    ...visibleRoute.flatMap((segment) => [segment.from, segment.to]),
  ];
  const bounds = getTileBounds(mapPoints.length > 0 ? mapPoints : center ? [center] : [{ latitude: 0, longitude: 0 }]);
  const mapTiles = getMapTiles(bounds);
  const positionedPins = getPositionedPins(pins, bounds);
  const routeStops = positionedPins
    .filter((pin) => pin.routeOrder)
    .sort((first, second) => (first.routeOrder ?? 99) - (second.routeOrder ?? 99));
  const defaultSelection = pins[1]?.id ?? pins[0]?.id ?? visibleRoute[0]?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(defaultSelection);
  const selectedPin = pins.find((pin) => pin.id === selectedId);
  const selectedRoute = visibleRoute.find((segment) => segment.id === selectedId);
  const selectedPinRoutePhoto = selectedPin?.linkedPhotoId ? routePhotos.get(selectedPin.linkedPhotoId) : undefined;
  const selectedPinRouteEntry = selectedPin?.linkedJournalEntryId ? routeEntries.get(selectedPin.linkedJournalEntryId) : undefined;
  const selectedRoutePhoto = selectedRoute?.linkedPhotoId ? routePhotos.get(selectedRoute.linkedPhotoId) : undefined;
  const selectedRouteEntry = selectedRoute?.linkedJournalEntryId ? routeEntries.get(selectedRoute.linkedJournalEntryId) : undefined;
  const selectedPhoto = selectedPinRoutePhoto ?? selectedRoutePhoto ?? selectedPin?.photo;
  const selectedEntry = selectedPinRouteEntry ?? selectedRouteEntry;

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
      <div className="flex items-center justify-between gap-3 border-b border-white/70 bg-white/60 px-4 py-3">
        <div>
          <p className="travel-kicker text-xs">Journey map</p>
          <h2 className="travel-hand mt-1 text-xl font-semibold text-[color:var(--ink)]">{city} route</h2>
        </div>
        <span className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900">
          {pins.length} pins / {visibleRoute.length} routes
        </span>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_12.25rem]">
        <div className="relative min-h-[20rem] overflow-hidden bg-[#dbeafe] sm:min-h-[22rem]">
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
            {visibleRoute.map((segment) => {
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
                  stroke="rgba(255,255,255,.92)"
                  strokeLinecap="round"
                  strokeWidth={isSelected ? 2.6 : 2}
                />
              );
            })}
            {visibleRoute.map((segment, index) => {
              const from = project(segment.from, bounds);
              const to = project(segment.to, bounds);
              const isSelected = selectedId === segment.id;
              return (
                <path
                  className="cursor-pointer transition"
                  d={getRoutePath(from, to)}
                  fill="none"
                  key={`${segment.id}-line`}
                  onClick={() => setSelectedId(segment.id)}
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
          {positionedPins.map((pin, index) => {
            const selected = selectedId === pin.id;
            const tone =
              pin.kind === "base"
                ? "border-sky-100 bg-sky-700 text-white"
                : index % 2 === 0
                  ? "border-rose-100 bg-rose-600 text-white"
                  : "border-amber-100 bg-amber-500 text-white";
            return (
              <button
                className={`absolute grid h-9 w-9 -translate-x-1/2 -translate-y-full place-items-center transition hover:scale-110 ${selected ? "z-40" : ""}`}
                key={pin.id}
                onClick={() => setSelectedId(pin.id)}
                style={{
                  left: `calc(${pin.position.x}% + ${pin.offsetX}px)`,
                  top: `calc(${pin.position.y}% + ${pin.offsetY}px)`,
                  zIndex: selected ? 35 : 12 + (pin.routeOrder ?? 0),
                }}
                title={pin.label}
                type="button"
              >
                <span
                  className={`grid h-7 w-7 rotate-45 place-items-center rounded-[50%_50%_50%_0] border-2 text-[0.64rem] font-bold shadow-[0_10px_24px_rgba(15,23,42,.25)] ${tone} ${
                    selected ? "ring-4 ring-white/80" : ""
                  }`}
                >
                  <span className="-rotate-45">{pin.routeOrder ?? (pin.kind === "base" ? "B" : index)}</span>
                </span>
              </button>
            );
          })}
          <div className="absolute bottom-3 left-3 rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-[0.68rem] font-semibold text-slate-700 shadow-sm">
            Tap map pins
          </div>
          <a
            className="absolute bottom-3 right-3 rounded-full bg-white/85 px-2 py-1 text-[0.62rem] font-semibold text-slate-600 shadow-sm"
            href="https://www.openstreetmap.org/copyright"
            rel="noreferrer"
            target="_blank"
          >
            OpenStreetMap
          </a>
        </div>

        <aside className="space-y-2.5 border-t border-white/70 bg-[rgba(255,255,255,.58)] p-2.5 lg:border-l lg:border-t-0">
          {routeStops.length > 0 ? (
            <div className="rounded-2xl border border-white/70 bg-white/70 p-2 shadow-sm">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="travel-kicker text-[0.62rem]">Route stops</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[0.62rem] font-semibold text-slate-600">{routeStops.length}</span>
              </div>
              <div className="mt-2 grid gap-1">
                {routeStops.map((pin) => (
                  <button
                    className={`grid grid-cols-[1.2rem_1fr] items-center gap-1.5 rounded-xl border px-1.5 py-1.5 text-left text-[0.68rem] font-semibold leading-4 transition ${
                      selectedId === pin.id ? "border-red-200 bg-red-50 text-red-700 shadow-sm" : "border-transparent bg-white/65 text-slate-700 hover:border-sky-100 hover:bg-sky-50"
                    }`}
                    key={`route-stop-${pin.id}`}
                    onClick={() => setSelectedId(pin.id)}
                    title={pin.label}
                    type="button"
                  >
                    <span className={`grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full text-[0.6rem] ${
                      selectedId === pin.id ? "bg-red-600 text-white" : "bg-slate-900 text-white"
                    }`}>{pin.routeOrder}</span>
                    <span className="line-clamp-2">{getRouteStopLabel(pin.label)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {selectedPin || selectedRoute ? (
            <div className="rounded-2xl border border-white/70 bg-white/65 p-2.5">
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
              {selectedEntry ? <p className="mt-3 line-clamp-2 text-xs font-semibold text-teal-900">{selectedEntry.title}</p> : null}
            </div>
          ) : (
            <p className="travel-muted text-xs leading-5">Choose a pin or route to see the record.</p>
          )}
        </aside>
      </div>
    </section>
  );
}
