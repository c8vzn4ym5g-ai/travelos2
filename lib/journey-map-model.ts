import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "./types";

export type MapScale = "regional" | "overview" | "detail" | "single";

export type StopIcon = "plane" | "village" | "circle" | "sled" | "fire" | "cabin" | "pin";

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

export type ItineraryStop = {
  dateLabel: string | null;
  icon: StopIcon;
  id: string;
  leg: "winter" | "side";
  linkedJournalEntryId: string | null;
  linkedPhotoId: string | null;
  listLabel: string;
  note: string | null;
  number: number;
  point: GeoPoint;
  title: string;
};

export type ArrivalCity = {
  id: string;
  label: string;
  shortLabel: string;
};

export type RegionalLeg = {
  from: GeoPoint;
  id: string;
  kind: "winter" | "side";
  style: "solid" | "dotted";
  to: GeoPoint;
};

export type JourneyItinerary = {
  arrival: ArrivalCity[] | null;
  regionalLegs: RegionalLeg[];
  regionalPoints: GeoPoint[];
  regionalStops: ItineraryStop[];
};

export type StopCardContent = {
  caption: string | null;
  photo: Photo | null;
  title: string;
  wording: string;
};

export type TileBounds = {
  maxX: number;
  maxY: number;
  minX: number;
  minY: number;
  zoom: number;
};

export const STREET_BASEMAP = {
  attribution: "© OpenStreetMap contributors © CARTO",
  attributionUrl: "https://www.openstreetmap.org/copyright",
  cartoAttributionUrl: "https://carto.com/attributions",
  name: "Carto Voyager",
  urlTemplate: "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
} as const;

export const TILE_PIXEL_SIZE = 256;

export const LAPLAND_POSTER = {
  alt: "Rovaniemi winter journey: Santa Claus Village, Helsinki, Finnish Lapland",
  relativeFile: "public/travelos/maps/lapland-rovaniemi.png",
  src: "/travelos/maps/lapland-rovaniemi.png",
} as const;

export const LAPLAND_GLANCE_LABELS = "Santa Claus Village (聖誕老人村) · Helsinki · Rovaniemi";

export const POSTER_THEME = {
  label: "#1e293b",
  pinBorder: "#d7ebe6",
  side: "#b65f44",
  sideBorder: "#f3d6c8",
  title: "#334155",
  winter: "#0f4f48",
} as const;

export type PosterPoint = {
  x: number;
  y: number;
};

export type PosterPin = {
  id: string;
  label: string;
  leg: "winter" | "side";
  number: number;
  point: GeoPoint;
  sublabel: string | null;
  x: number;
  y: number;
};

export type PosterLeg = {
  from: PosterPoint;
  id: string;
  kind: "winter" | "side";
  style: "solid" | "dotted";
  to: PosterPoint;
};

export type PosterLayout = {
  bounds: TileBounds;
  cityLabel: string;
  legs: PosterLeg[];
  longHaulLabel: string | null;
  pins: PosterPin[];
  sidePath: PosterPoint[];
  winterPath: PosterPoint[];
};

export function getStreetTileUrl(zoom: number, x: number, y: number) {
  return STREET_BASEMAP.urlTemplate
    .replace("{z}", String(zoom))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

const LOCAL_SPAN_DEGREES = 2.5;
const LONG_HAUL_SPAN_DEGREES = 8;
const MIN_REGIONAL_SPAN_DEGREES = 0.1;
const LAPLAND_CAMPFIRE_POINT: GeoPoint = { latitude: 66.5004, longitude: 25.7148 };
const LAPLAND_ARCTIC_DISPLAY: GeoPoint = { latitude: 66.5534, longitude: 25.8216 };
const LAPLAND_CITY: GeoPoint = { latitude: 66.5039, longitude: 25.7294 };

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

export function pointKey(point: GeoPoint) {
  return `${point.latitude.toFixed(4)},${point.longitude.toFixed(4)}`;
}

export function getFirstWordingBlock(text: string) {
  return text.split(/\n\n/)[0]?.trim() || text;
}

export function formatStopDate(date: string | null | undefined) {
  if (!date) {
    return null;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  if (!match) {
    return null;
  }

  return `${Number(match[2])}/${Number(match[3])}`;
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

function findPlace(places: Place[], idsOrNames: string[]) {
  const needles = idsOrNames.map((value) => value.toLowerCase());
  return places.find((place) => needles.includes(place.id.toLowerCase()) || needles.includes(place.name.toLowerCase()));
}

function findJournal(entries: JournalEntry[], idsOrTitles: string[]) {
  const needles = idsOrTitles.map((value) => value.toLowerCase());
  return entries.find((entry) => needles.includes(entry.id.toLowerCase()) || needles.some((needle) => entry.title.toLowerCase().includes(needle)));
}

function findPhoto(photos: Photo[], ids: string[]) {
  return photos.find((photo) => ids.includes(photo.id));
}

function isFinnishLaplandCluster(city: string, places: Place[]) {
  if (city.toLowerCase() === "rovaniemi") {
    return true;
  }

  return places.some((place) => /santa claus village/i.test(place.name) && /rovaniemi|finland/i.test(`${place.city} ${place.country}`));
}

function toStopCardPin(stop: ItineraryStop): MapPin {
  return {
    displayNumber: stop.number,
    id: stop.id,
    kind: "place",
    label: stop.title,
    linkedJournalEntryId: stop.linkedJournalEntryId,
    linkedPhotoId: stop.linkedPhotoId,
    note: stop.note,
    point: stop.point,
    routeOrder: stop.number,
  };
}

export function getStopCardContent({
  journalEntries,
  photos,
  pin,
  route,
  stop,
}: {
  journalEntries: JournalEntry[];
  photos: Photo[];
  pin?: MapPin | null;
  route?: TravelRouteSegment | null;
  stop?: ItineraryStop | null;
}): StopCardContent | null {
  const resolvedPin = pin ?? (stop ? toStopCardPin(stop) : null);

  if (!resolvedPin && !route) {
    return null;
  }

  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const journalsById = new Map(journalEntries.map((entry) => [entry.id, entry]));
  const photo =
    (resolvedPin?.linkedPhotoId ? photosById.get(resolvedPin.linkedPhotoId) : undefined) ??
    (route?.linkedPhotoId ? photosById.get(route.linkedPhotoId) : undefined) ??
    resolvedPin?.photo ??
    null;
  const journal =
    (resolvedPin?.linkedJournalEntryId ? journalsById.get(resolvedPin.linkedJournalEntryId) : undefined) ??
    (route?.linkedJournalEntryId ? journalsById.get(route.linkedJournalEntryId) : undefined) ??
    resolvedPin?.journal;
  const title = journal?.title ?? stop?.title ?? (route ? `${route.fromLabel} to ${route.toLabel}` : resolvedPin?.label) ?? "Stop";
  const wording = journal?.body ?? resolvedPin?.note ?? stop?.note ?? route?.note ?? photo?.caption ?? "No note yet.";

  return {
    caption: photo?.caption && photo.caption !== wording ? photo.caption : null,
    photo: photo ?? null,
    title,
    wording,
  };
}

function buildLaplandItinerary({
  journalEntries,
  photos,
  places,
}: {
  journalEntries: JournalEntry[];
  photos: Photo[];
  places: Place[];
}): JourneyItinerary {
  const airport = findPlace(places, ["place_lapland_rovaniemi_airport", "Rovaniemi Airport"]);
  const santa = findPlace(places, ["place_lapland_santa_village", "Santa Claus Village"]);
  const arctic = findPlace(places, ["place_lapland_arctic_circle", "Arctic Circle Line"]);
  const sled = findPlace(places, ["place_lapland_sled", "Sled route"]);
  const cabin = findPlace(places, ["place_lapland_snow_cabin", "Snow cabin"]);
  const arrivalJournal = findJournal(journalEntries, ["journal_lapland_arrival", "arctic circle", "抵達"]);
  const santaJournal = findJournal(journalEntries, ["journal_lapland_santa", "santa claus village", "聖誕老人村"]);
  const campfireJournal = findJournal(journalEntries, ["journal_lapland_campfire", "campfire", "雪地營火"]);
  const arcticPhoto = findPhoto(photos, ["photo_lapland_arctic_circle"]);
  const santaPhoto = findPhoto(photos, ["photo_lapland_santa_night"]);
  const sledPhoto = findPhoto(photos, ["photo_lapland_sled"]);
  const campfirePhoto = findPhoto(photos, ["photo_lapland_campfire"]);
  const cabinPhoto = findPhoto(photos, ["photo_lapland_snow_cabin"]);
  const airportPoint = airport?.coordinates ?? { latitude: 66.5648, longitude: 25.8304 };
  const santaPoint = santa?.coordinates ?? { latitude: 66.5436, longitude: 25.8472 };
  const arcticPoint = arctic && pointSpan(arctic.coordinates ?? santaPoint, santaPoint) > 0.004 ? (arctic.coordinates as GeoPoint) : LAPLAND_ARCTIC_DISPLAY;
  const sledPoint = sled?.coordinates ?? { latitude: 66.5382, longitude: 25.8595 };
  const cabinPoint = cabin?.coordinates ?? { latitude: 66.4958, longitude: 25.7012 };

  const regionalStops: ItineraryStop[] = [
    {
      dateLabel: formatStopDate(arrivalJournal?.entryDate) ?? "1/18",
      icon: "plane",
      id: airport?.id ?? "stop_lapland_arrival",
      leg: "winter",
      linkedJournalEntryId: arrivalJournal?.id ?? "journal_lapland_arrival",
      linkedPhotoId: arcticPhoto?.id ?? arrivalJournal?.storyPhotoId ?? null,
      listLabel: "羅瓦涅米 / Rovaniemi",
      note: airport?.notes ?? arrivalJournal?.body ?? null,
      number: 1,
      point: airportPoint,
      title: arrivalJournal?.title ?? "抵達北極圈 / Arrival at the Arctic Circle",
    },
    {
      dateLabel: formatStopDate(santaJournal?.entryDate) ?? "1/20",
      icon: "village",
      id: santa?.id ?? "stop_lapland_santa",
      leg: "winter",
      linkedJournalEntryId: santaJournal?.id ?? "journal_lapland_santa",
      linkedPhotoId: santaPhoto?.id ?? santaJournal?.storyPhotoId ?? null,
      listLabel: "聖誕老人村 / Santa Claus Village",
      note: santa?.notes ?? santaJournal?.body ?? null,
      number: 2,
      point: santaPoint,
      title: santaJournal?.title ?? "聖誕老人村 / Santa Claus Village",
    },
    {
      dateLabel: null,
      icon: "circle",
      id: arctic?.id ?? "stop_lapland_arctic",
      leg: "winter",
      linkedJournalEntryId: arrivalJournal?.id ?? null,
      linkedPhotoId: arcticPhoto?.id ?? null,
      listLabel: "北極圈 / Arctic Circle",
      note: arctic?.notes ?? arcticPhoto?.caption ?? null,
      number: 3,
      point: arcticPoint,
      title: arctic?.name ? "北極圈 / Arctic Circle" : "Arctic Circle",
    },
    {
      dateLabel: formatStopDate(sledPhoto?.takenAt),
      icon: "sled",
      id: sled?.id ?? "stop_lapland_sled",
      leg: "side",
      linkedJournalEntryId: null,
      linkedPhotoId: sledPhoto?.id ?? null,
      listLabel: "雪橇 / Sled",
      note: sled?.notes ?? sledPhoto?.caption ?? null,
      number: 4,
      point: sledPoint,
      title: "雪橇 / Sled",
    },
    {
      dateLabel: formatStopDate(campfireJournal?.entryDate) ?? "1/22",
      icon: "fire",
      id: campfireJournal?.id ?? "stop_lapland_campfire",
      leg: "winter",
      linkedJournalEntryId: campfireJournal?.id ?? "journal_lapland_campfire",
      linkedPhotoId: campfirePhoto?.id ?? campfireJournal?.storyPhotoId ?? null,
      listLabel: "雪地營火 / Campfire",
      note: campfireJournal?.body ?? campfirePhoto?.caption ?? null,
      number: 5,
      point: LAPLAND_CAMPFIRE_POINT,
      title: campfireJournal?.title ?? "雪地營火 / Campfire in the snow",
    },
    {
      dateLabel: formatStopDate(cabinPhoto?.takenAt),
      icon: "cabin",
      id: cabin?.id ?? "stop_lapland_cabin",
      leg: "winter",
      linkedJournalEntryId: null,
      linkedPhotoId: cabinPhoto?.id ?? null,
      listLabel: "雪屋 / Cabin",
      note: cabin?.notes ?? cabinPhoto?.caption ?? null,
      number: 6,
      point: cabinPoint,
      title: "雪屋 / Cabin",
    },
  ];

  const regionalLegs: RegionalLeg[] = [
    { from: airportPoint, id: "leg_airport_city", kind: "winter", style: "solid", to: LAPLAND_CITY },
    { from: LAPLAND_CITY, id: "leg_city_santa", kind: "winter", style: "solid", to: santaPoint },
    { from: santaPoint, id: "leg_santa_arctic", kind: "winter", style: "solid", to: arcticPoint },
    { from: santaPoint, id: "leg_santa_sled", kind: "side", style: "dotted", to: sledPoint },
    { from: LAPLAND_CITY, id: "leg_city_cabin", kind: "winter", style: "solid", to: cabinPoint },
    { from: cabinPoint, id: "leg_cabin_campfire", kind: "winter", style: "solid", to: LAPLAND_CAMPFIRE_POINT },
  ];

  return {
    arrival: [
      { id: "arrival_hk", label: "Hong Kong", shortLabel: "HK" },
      { id: "arrival_hel", label: "Helsinki", shortLabel: "HEL" },
      { id: "arrival_rvn", label: "Rovaniemi", shortLabel: "RVN" },
    ],
    regionalLegs,
    regionalPoints: [...regionalStops.map((stop) => stop.point), LAPLAND_CITY],
    regionalStops,
  };
}

function buildGenericItinerary({
  center,
  city,
  journalEntries,
  photos,
  places,
  route,
}: {
  center: GeoPoint | null;
  city: string;
  journalEntries: JournalEntry[];
  photos: Photo[];
  places: Place[];
  route: TravelRouteSegment[];
}): JourneyItinerary {
  const visibleRoute = route.filter(isVisibleRoute);
  const flights = visibleRoute.filter((segment) => segment.transport === "flight");
  const localRoutes = visibleRoute.filter((segment) => segment.transport !== "flight");
  const mappedPlaces = places.filter((place) => place.coordinates);
  const anchor = getLocalAnchor(center, visibleRoute, mappedPlaces);
  const localPlaces = mappedPlaces.filter((place) => place.coordinates && isLocalPoint(place.coordinates, anchor));
  const hasLongHaul = flights.some((segment) => pointSpan(segment.from, segment.to) > LONG_HAUL_SPAN_DEGREES);
  const arrival = hasLongHaul
    ? [
        { id: "arrival_from", label: flights[0]?.fromLabel ?? "Start", shortLabel: (flights[0]?.fromLabel ?? "Start").slice(0, 3).toUpperCase() },
        { id: "arrival_to", label: city, shortLabel: city.slice(0, 3).toUpperCase() },
      ]
    : null;
  const journalsById = new Map(journalEntries.map((entry) => [entry.id, entry]));
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));
  const regionalStops = localPlaces.map((place, index) => {
    const matchingRoute = localRoutes.find((segment) => segment.linkedPlaceId === place.id || segment.toLabel.toLowerCase() === place.name.toLowerCase());
    const journal = matchingRoute?.linkedJournalEntryId ? journalsById.get(matchingRoute.linkedJournalEntryId) : undefined;
    const photo = matchingRoute?.linkedPhotoId ? photosById.get(matchingRoute.linkedPhotoId) : undefined;

    return {
      dateLabel: formatStopDate(journal?.entryDate ?? photo?.takenAt),
      icon: "pin" as const,
      id: place.id,
      leg: matchingRoute?.transport === "other" ? ("side" as const) : ("winter" as const),
      linkedJournalEntryId: matchingRoute?.linkedJournalEntryId ?? journal?.id ?? null,
      linkedPhotoId: matchingRoute?.linkedPhotoId ?? photo?.id ?? null,
      listLabel: place.name,
      note: place.notes,
      number: index + 1,
      point: place.coordinates as GeoPoint,
      title: journal?.title ?? place.name,
    };
  });
  const regionalLegs: RegionalLeg[] = localRoutes.map((segment) => ({
    from: segment.from,
    id: segment.id,
    kind: segment.transport === "other" ? "side" : "winter",
    style: segment.transport === "other" || segment.transport === "walk" ? "dotted" : "solid",
    to: segment.to,
  }));

  return {
    arrival,
    regionalLegs,
    regionalPoints: [
      ...regionalStops.map((stop) => stop.point),
      ...regionalLegs.flatMap((leg) => [leg.from, leg.to]),
      ...(center && isLocalPoint(center, anchor) ? [center] : []),
    ],
    regionalStops,
  };
}

export function buildJourneyItinerary({
  center,
  city,
  journalEntries,
  photos,
  places,
  route,
}: {
  center: GeoPoint | null;
  city: string;
  journalEntries: JournalEntry[];
  photos: Photo[];
  places: Place[];
  route: TravelRouteSegment[];
}): JourneyItinerary {
  if (isFinnishLaplandCluster(city, places)) {
    return buildLaplandItinerary({ journalEntries, photos, places });
  }

  return buildGenericItinerary({ center, city, journalEntries, photos, places, route });
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

function expandToRegionalSpan(points: GeoPoint[]) {
  const bounds = getGeoBounds(points);
  const latSpan = Math.max(bounds.maxLat - bounds.minLat, MIN_REGIONAL_SPAN_DEGREES);
  const lngSpan = Math.max(bounds.maxLng - bounds.minLng, MIN_REGIONAL_SPAN_DEGREES);
  const midLat = (bounds.maxLat + bounds.minLat) / 2;
  const midLng = (bounds.maxLng + bounds.minLng) / 2;

  return [
    { latitude: midLat - latSpan / 2, longitude: midLng - lngSpan / 2 },
    { latitude: midLat + latSpan / 2, longitude: midLng + lngSpan / 2 },
    ...points,
  ];
}

export function chooseZoom(points: GeoPoint[], scale: MapScale = "regional") {
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

  if (scale === "regional") {
    if (span > 0.45) {
      return 11;
    }

    if (span > 0.22) {
      return 12;
    }

    return 13;
  }

  if (span > 0.45) {
    return 9;
  }

  if (span > 0.22) {
    return 10;
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

export function getTileBounds(points: GeoPoint[], scale: MapScale = "regional"): TileBounds {
  const framedPoints = scale === "regional" ? expandToRegionalSpan(points) : points;
  const zoom = chooseZoom(framedPoints, scale);
  const xs = framedPoints.map((point) => longitudeToTileX(point.longitude, zoom));
  const ys = framedPoints.map((point) => latitudeToTileY(point.latitude, zoom));
  const xSpan = Math.max(...xs) - Math.min(...xs);
  const ySpan = Math.max(...ys) - Math.min(...ys);
  const pad = scale === "regional" ? Math.max(0.42, Math.max(xSpan, ySpan) * 0.2) : Math.max(0.35, Math.max(xSpan, ySpan) * 0.18);

  return {
    maxX: Math.max(...xs) + pad,
    maxY: Math.max(...ys) + pad,
    minX: Math.min(...xs) - pad,
    minY: Math.min(...ys) - pad,
    zoom,
  };
}

export function getLaplandPictureBounds(points: GeoPoint[]): TileBounds {
  const zoom = 13;
  const xs = points.map((point) => longitudeToTileX(point.longitude, zoom));
  const ys = points.map((point) => latitudeToTileY(point.latitude, zoom));
  const xSpan = Math.max(Math.max(...xs) - Math.min(...xs), 0.01);
  const ySpan = Math.max(Math.max(...ys) - Math.min(...ys), 0.01);
  const padX = Math.max(0.32, xSpan * 0.16);
  const padY = Math.max(0.26, ySpan * 0.14);

  return {
    maxX: Math.max(...xs) + padX + 0.06,
    maxY: Math.max(...ys) + padY * 0.7,
    minX: Math.min(...xs) - padX,
    minY: Math.min(...ys) - padY - 0.08,
    zoom,
  };
}

export const WINTER_PICTURE_ORDER = [1, 2, 5, 6];
export const SIDE_PICTURE_ORDER = [2, 4];

export function pathFromPinOrder(pins: PosterPin[], order: readonly number[]): PosterPoint[] {
  return order
    .map((number) => pins.find((pin) => pin.number === number))
    .filter((pin): pin is PosterPin => Boolean(pin))
    .map((pin) => ({ x: pin.x, y: pin.y }));
}

export function formatLongHaulLabel(arrival: ArrivalCity[] | null) {
  if (!arrival || arrival.length === 0) {
    return null;
  }

  return arrival.map((city) => city.shortLabel).join(" · ");
}

export function getMapTiles(bounds: TileBounds) {
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
        src: getStreetTileUrl(bounds.zoom, wrappedX, y),
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

export function projectRaw(point: GeoPoint, bounds: TileBounds): PosterPoint {
  const x = ((longitudeToTileX(point.longitude, bounds.zoom) - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 0.0001)) * 100;
  const y = ((latitudeToTileY(point.latitude, bounds.zoom) - bounds.minY) / Math.max(bounds.maxY - bounds.minY, 0.0001)) * 100;
  return { x, y };
}

export function project(point: GeoPoint, bounds: TileBounds) {
  const raw = projectRaw(point, bounds);
  return {
    x: Math.min(94, Math.max(6, raw.x)),
    y: Math.min(90, Math.max(10, raw.y)),
  };
}

export function posterShortLabel(stop: ItineraryStop) {
  const english = stop.listLabel.includes(" / ") ? stop.listLabel.split(" / ").pop()?.trim() : stop.listLabel;
  return english || stop.listLabel;
}

export function spaceItineraryPins(stops: ItineraryStop[], bounds: TileBounds): PosterPin[] {
  const items = stops.map((stop) => ({
    ...stop,
    position: projectRaw(stop.point, bounds),
  }));

  for (let pass = 0; pass < 3; pass += 1) {
    for (let index = 0; index < items.length; index += 1) {
      for (let other = index + 1; other < items.length; other += 1) {
        const dx = items[other].position.x - items[index].position.x;
        const dy = items[other].position.y - items[index].position.y;
        const distance = Math.hypot(dx, dy) || 0.01;
        const minDistance = 9;
        if (distance >= minDistance) {
          continue;
        }

        const push = (minDistance - distance) / 2;
        const ux = dx / distance;
        const uy = dy / distance;
        items[index].position = {
          x: items[index].position.x - ux * push,
          y: items[index].position.y - uy * push,
        };
        items[other].position = {
          x: items[other].position.x + ux * push,
          y: items[other].position.y + uy * push,
        };
      }
    }
  }

  return items.map((item) => ({
    id: item.id,
    label: posterShortLabel(item),
    leg: item.leg,
    number: item.number,
    point: item.point,
    sublabel: item.number === 2 && item.listLabel.includes("聖誕老人村") ? "聖誕老人村" : null,
    x: Math.min(94, Math.max(6, item.position.x)),
    y: Math.min(92, Math.max(8, item.position.y)),
  }));
}

export function buildPosterLayout(itinerary: JourneyItinerary, city = "Rovaniemi"): PosterLayout {
  const points = itinerary.regionalPoints.length > 0 ? itinerary.regionalPoints : itinerary.regionalStops.map((stop) => stop.point);
  const fallback = points.length > 0 ? points : [{ latitude: 66.5039, longitude: 25.7294 }];
  const bounds = isLaplandPosterCity(city) ? getLaplandPictureBounds(fallback) : getTileBounds(fallback, "regional");
  const pins = spaceItineraryPins(itinerary.regionalStops, bounds);

  return {
    bounds,
    cityLabel: isLaplandPosterCity(city) ? "Rovaniemi" : `${city} · itinerary`,
    legs: itinerary.regionalLegs.map((leg) => ({
      from: projectRaw(leg.from, bounds),
      id: leg.id,
      kind: leg.kind,
      style: leg.style,
      to: projectRaw(leg.to, bounds),
    })),
    longHaulLabel: isLaplandPosterCity(city) ? "Helsinki · Rovaniemi" : formatLongHaulLabel(itinerary.arrival),
    pins,
    sidePath: pathFromPinOrder(pins, SIDE_PICTURE_ORDER),
    winterPath: pathFromPinOrder(pins, WINTER_PICTURE_ORDER),
  };
}

export function getPosterTileGrid(bounds: TileBounds) {
  const tileCount = 2 ** bounds.zoom;
  return {
    maxX: Math.floor(bounds.maxX),
    maxY: Math.min(tileCount - 1, Math.floor(bounds.maxY)),
    minX: Math.floor(bounds.minX),
    minY: Math.max(0, Math.floor(bounds.minY)),
    tileCount,
  };
}

export function getPosterRasterSize(bounds: TileBounds) {
  return {
    height: Math.max(1, Math.round((bounds.maxY - bounds.minY) * TILE_PIXEL_SIZE)),
    width: Math.max(1, Math.round((bounds.maxX - bounds.minX) * TILE_PIXEL_SIZE)),
  };
}

export function isLaplandPosterCity(city: string) {
  return city.trim().toLowerCase() === "rovaniemi";
}

export function isRegionalPointSet(points: GeoPoint[]) {
  if (points.length === 0) {
    return false;
  }

  const bounds = getGeoBounds(points);
  return Math.max(bounds.maxLat - bounds.minLat, bounds.maxLng - bounds.minLng) < LOCAL_SPAN_DEGREES;
}
