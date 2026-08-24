import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "./types";

export type MapScale = "overview" | "detail" | "single";

export type MapPin = {
  id: string;
  label: string;
  point: GeoPoint;
  note: string | null;
  kind: "base" | "place" | "photo";
  linkedJournalEntryId?: string | null;
  linkedPhotoId?: string | null;
  routeOrder?: number;
  displayNumber?: number;
  photo?: Photo;
  journal?: JournalEntry;
};

export type RouteStop = {
  label: string;
  linkedJournalEntryId: string | null;
  linkedPhotoId: string | null;
  order: number;
  point: GeoPoint;
};

export type ScaleSlice = {
  places: Place[];
  points: GeoPoint[];
  route: TravelRouteSegment[];
  scale: MapScale;
  showBase: boolean;
};

export type StopCardContent = {
  caption: string | null;
  photo: Photo | null;
  title: string;
  wording: string;
};

const LOCAL_SPAN_DEGREES = 2.5;
const LONG_HAUL_SPAN_DEGREES = 8;

export function isVisibleRoute(segment: TravelRouteSegment) {
  return segment.visibility !== "private";
}

export function isRenderablePhoto(photo: Photo | null | undefined): photo is Photo {
  return Boolean(photo && (photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/")));
}

export function pointSpan(first: GeoPoint, second: GeoPoint) {
  return Math.max(Math.abs(first.latitude - second.latitude), Math.abs(first.longitude - second.longitude));
}

export function isLocalPoint(point: GeoPoint, anchor: GeoPoint | null) {
  if (!anchor) {
    return true;
  }

  return pointSpan(point, anchor) < LOCAL_SPAN_DEGREES;
}

function placeMatchesRouteEndpoint(place: Place, segments: TravelRouteSegment[]) {
  const name = place.name.toLowerCase();
  return segments.some((segment) => {
    const labels = [segment.fromLabel, segment.toLabel].map((label) => label.toLowerCase());
    return labels.some((label) => {
      if (name === label || name.includes(label) || label.includes(name)) {
        return true;
      }

      const strippedName = name.replace(/\s+(international\s+)?airport$/i, "").trim();
      const strippedLabel = label.replace(/\s+(international\s+)?airport$/i, "").trim();
      return strippedName.length > 2 && strippedLabel.length > 2 && (strippedName === strippedLabel || name.includes(strippedLabel));
    });
  });
}

function getLocalAnchor(center: GeoPoint | null, route: TravelRouteSegment[], places: Place[]): GeoPoint | null {
  if (center) {
    return center;
  }

  const localRoutePoint = route.find((segment) => segment.transport !== "flight")?.to;
  if (localRoutePoint) {
    return localRoutePoint;
  }

  return places.find((place) => place.coordinates)?.coordinates ?? null;
}

export function partitionJourneyScales({
  center,
  places,
  route,
}: {
  center: GeoPoint | null;
  places: Place[];
  route: TravelRouteSegment[];
}): { detail: ScaleSlice | null; overview: ScaleSlice | null; single: ScaleSlice | null } {
  const visibleRoute = route.filter(isVisibleRoute);
  const flights = visibleRoute.filter((segment) => segment.transport === "flight");
  const localRoutes = visibleRoute.filter((segment) => segment.transport !== "flight");
  const mappedPlaces = places.filter((place) => place.coordinates);
  const anchor = getLocalAnchor(center, visibleRoute, mappedPlaces);
  const hasLongHaul = flights.some((segment) => pointSpan(segment.from, segment.to) > LONG_HAUL_SPAN_DEGREES);
  const localPlaces = mappedPlaces.filter((place) => place.coordinates && isLocalPoint(place.coordinates, anchor));
  const hasLocalCluster = localPlaces.length > 0 || localRoutes.length > 0;

  if (!hasLongHaul || !hasLocalCluster) {
    const points = [
      ...mappedPlaces.map((place) => place.coordinates as GeoPoint),
      ...visibleRoute.flatMap((segment) => [segment.from, segment.to]),
      ...(center ? [center] : []),
    ];

    return {
      detail: null,
      overview: null,
      single: {
        places: mappedPlaces,
        points,
        route: visibleRoute,
        scale: "single",
        showBase: Boolean(center),
      },
    };
  }

  const overviewPlaces = mappedPlaces.filter((place) => placeMatchesRouteEndpoint(place, flights));
  const overviewPoints = [
    ...overviewPlaces.map((place) => place.coordinates as GeoPoint),
    ...flights.flatMap((segment) => [segment.from, segment.to]),
  ];
  const detailPoints = [
    ...localPlaces.map((place) => place.coordinates as GeoPoint),
    ...localRoutes.flatMap((segment) => [segment.from, segment.to]),
    ...(center ? [center] : []),
  ];

  return {
    detail: {
      places: localPlaces,
      points: detailPoints,
      route: localRoutes,
      scale: "detail",
      showBase: Boolean(center),
    },
    overview: {
      places: overviewPlaces,
      points: overviewPoints,
      route: flights,
      scale: "overview",
      showBase: false,
    },
    single: null,
  };
}

export function getRouteStops(route: TravelRouteSegment[]) {
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

export function findRouteStopForPin(pinLabel: string, point: GeoPoint, routeStops: RouteStop[]) {
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

export function pointKey(point: GeoPoint) {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

export function buildScalePins({
  center,
  city,
  country,
  journalEntries,
  photos,
  places,
  routeStops,
  showBase,
}: {
  center: GeoPoint | null;
  city: string;
  country: string;
  journalEntries: JournalEntry[];
  photos: Photo[];
  places: Place[];
  routeStops: RouteStop[];
  showBase: boolean;
}): MapPin[] {
  const journalsById = new Map(journalEntries.map((entry) => [entry.id, entry]));
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const placePins = places
    .filter((place) => place.coordinates)
    .map((place) => {
      const routeStop = place.coordinates ? findRouteStopForPin(place.name, place.coordinates, routeStops) : undefined;
      const linkedPhoto =
        (routeStop?.linkedPhotoId ? photosById.get(routeStop.linkedPhotoId) : undefined) ??
        photos.find(
          (photo) =>
            photo.coordinates &&
            place.coordinates &&
            photo.coordinates.latitude === place.coordinates.latitude &&
            photo.coordinates.longitude === place.coordinates.longitude,
        );
      const linkedJournal = routeStop?.linkedJournalEntryId ? journalsById.get(routeStop.linkedJournalEntryId) : undefined;

      return {
        id: place.id,
        journal: linkedJournal,
        kind: "place" as const,
        label: place.name,
        linkedJournalEntryId: routeStop?.linkedJournalEntryId,
        linkedPhotoId: routeStop?.linkedPhotoId ?? linkedPhoto?.id,
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

  const basePin: MapPin[] =
    showBase && center
      ? [
          {
            id: "trip_base",
            journal: undefined,
            kind: "base",
            label: `${city}, ${country}`,
            linkedJournalEntryId: findRouteStopForPin(city, center, routeStops)?.linkedJournalEntryId,
            linkedPhotoId: findRouteStopForPin(city, center, routeStops)?.linkedPhotoId,
            note: `${city} trip base`,
            photo: undefined,
            point: center,
            routeOrder: findRouteStopForPin(city, center, routeStops)?.order,
          },
        ]
      : [];

  return numberPins([...basePin, ...placePins]);
}

export function numberPins(pins: MapPin[]) {
  const ranked = [...pins].sort((first, second) => {
    if (first.routeOrder && second.routeOrder) {
      return first.routeOrder - second.routeOrder;
    }

    if (first.routeOrder) {
      return -1;
    }

    if (second.routeOrder) {
      return 1;
    }

    if (first.kind === "base") {
      return -1;
    }

    if (second.kind === "base") {
      return 1;
    }

    return first.label.localeCompare(second.label);
  });

  ranked.forEach((pin, index) => {
    pin.displayNumber = index + 1;
  });

  return ranked;
}

export function getStopCardContent({
  journalEntries,
  photos,
  pin,
  route,
}: {
  journalEntries: JournalEntry[];
  photos: Photo[];
  pin?: MapPin | null;
  route?: TravelRouteSegment | null;
}): StopCardContent | null {
  if (!pin && !route) {
    return null;
  }

  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const journalsById = new Map(journalEntries.map((entry) => [entry.id, entry]));
  const photo =
    (pin?.linkedPhotoId ? photosById.get(pin.linkedPhotoId) : undefined) ??
    (route?.linkedPhotoId ? photosById.get(route.linkedPhotoId) : undefined) ??
    pin?.photo ??
    null;
  const journal =
    (pin?.linkedJournalEntryId ? journalsById.get(pin.linkedJournalEntryId) : undefined) ??
    (route?.linkedJournalEntryId ? journalsById.get(route.linkedJournalEntryId) : undefined) ??
    pin?.journal;
  const title = journal?.title ?? (route ? `${route.fromLabel} to ${route.toLabel}` : pin?.label) ?? "Stop";
  const wording =
    journal?.body ??
    pin?.note ??
    route?.note ??
    photo?.caption ??
    "No note yet.";

  return {
    caption: photo?.caption && photo.caption !== wording ? photo.caption : null,
    photo: photo ?? null,
    title,
    wording,
  };
}

export function getFirstWordingBlock(text: string) {
  return text.split(/\n\n/)[0]?.trim() || text;
}

export function getGeoBounds(points: GeoPoint[]) {
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);

  return {
    maxLat: Math.max(...latitudes),
    maxLng: Math.max(...longitudes),
    minLat: Math.min(...latitudes),
    minLng: Math.min(...longitudes),
  };
}

export function chooseZoom(points: GeoPoint[], scale: MapScale) {
  const bounds = getGeoBounds(points);
  const span = Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng);

  if (scale === "overview") {
    if (span > 50) {
      return 2;
    }

    if (span > 20) {
      return 3;
    }

    if (span > 8) {
      return 4;
    }

    return 5;
  }

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

export function getTileBounds(points: GeoPoint[], scale: MapScale) {
  const zoom = chooseZoom(points, scale);
  const xs = points.map((point) => longitudeToTileX(point.longitude, zoom));
  const ys = points.map((point) => latitudeToTileY(point.latitude, zoom));
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  const pad = scale === "overview" ? Math.max(0.55, Math.max(xSpan, ySpan) * 0.22) : Math.max(0.35, Math.max(xSpan, ySpan) * 0.18);

  return {
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    zoom,
  };
}

export function getMapTiles(bounds: ReturnType<typeof getTileBounds>) {
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

export function project(point: GeoPoint, bounds: ReturnType<typeof getTileBounds>) {
  const x = ((longitudeToTileX(point.longitude, bounds.zoom) - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100;
  const y = ((latitudeToTileY(point.latitude, bounds.zoom) - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100;

  return {
    x: Math.min(96, Math.max(4, x)),
    y: Math.min(92, Math.max(8, y)),
  };
}
