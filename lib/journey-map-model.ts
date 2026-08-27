import type { GeoPoint, JournalEntry, Photo, Place, TravelRouteSegment } from "./types";

export type MapScale = "regional" | "overview" | "detail" | "single";

export type StopIcon = "plane" | "village" | "circle" | "sled" | "fire" | "cabin" | "cathedral" | "harbour" | "pin";

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
  attribution: "© OpenStreetMap contributors, SRTM © OpenTopoMap (CC-BY-SA)",
  attributionUrl: "https://www.openstreetmap.org/copyright",
  cartoAttributionUrl: "https://opentopomap.org/about",
  name: "OpenTopoMap",
  urlTemplate: "https://tile.opentopomap.org/{z}/{x}/{y}.png",
} as const;

export const TILE_PIXEL_SIZE = 256;

export const LAPLAND_POSTER = {
  alt: "December path: Santa Claus Village and the Arctic Circle in Lapland, then Helsinki Cathedral and South Harbour",
  relativeFile: "public/travelos/maps/lapland-helsinki-poster.jpg",
  src: "/travelos/maps/lapland-helsinki-poster.jpg",
} as const;

export const LAPLAND_POSTER_GENERATOR_FILE = "public/travelos/maps/lapland-rovaniemi.png";

export const LAPLAND_GLANCE_LABELS = "Santa Claus Village (聖誕老人村) · Helsinki";

export const LAPLAND_PATH_HEADING = "拉普蘭，然後赫爾辛基 / Lapland, then Helsinki";

export const LAPLAND_POSTER_WIDTH = 1200;
export const LAPLAND_POSTER_HEIGHT = 1800;

export const LAPLAND_GLANCE_HOTSPOTS = [
  { href: "#arctic-circle", id: "tap-arctic", label: "極地之旅 / Arctic Journey", x: 0.378906, y: 0.873047, w: 0.114258, h: 0.10612 },
  { href: "#place-knowledge", id: "tap-nature", label: "自然風光 / Scenic Nature", x: 0.493164, y: 0.873047, w: 0.115234, h: 0.10612 },
  { href: "#cabin-4", id: "tap-stay", label: "在地體驗 / Local Experience", x: 0.608398, y: 0.873047, w: 0.109375, h: 0.10612 },
  { href: "#christmas-window", id: "tap-winter", label: "冬季限定 / Winter Exclusive", x: 0.717773, y: 0.873047, w: 0.099609, h: 0.10612 },
] as const;

export const LAPLAND_POSTER_MAP_RATIO = 0.7;
export const LAPLAND_POSTER_LEGEND_RATIO = 0.3;

export const LAPLAND_POSTER_FRAME = {
  maxLat: 67.4,
  minLat: 59.6,
  minLng: 21.6,
  maxLng: 29.05,
  zoom: 8,
} as const;

export type LaplandPosterPhase = "christmas" | "city";

export type LaplandPosterNote = {
  blurbEn: string;
  blurbZh: string;
  number: number;
  phase: LaplandPosterPhase;
  titleEn: string;
  titleZh: string;
};

export const LAPLAND_POSTER_NOTES: LaplandPosterNote[] = [
  {
    blurbEn: "Snow timber houses on the Circle",
    blurbZh: "北極圈上，積雪木屋",
    number: 1,
    phase: "christmas",
    titleEn: "Santa Claus Village",
    titleZh: "聖誕老人村",
  },
  {
    blurbEn: "The line you can walk across in the square",
    blurbZh: "廣場上可以走過去的那條線",
    number: 2,
    phase: "christmas",
    titleEn: "Arctic Circle",
    titleZh: "北極圈",
  },
  {
    blurbEn: "A snowman, a sled, the night's stay",
    blurbZh: "雪人、雪橇、過夜的地方",
    number: 3,
    phase: "christmas",
    titleEn: "Rovaniemi",
    titleZh: "羅瓦涅米",
  },
  {
    blurbEn: "The white church of Helsinki",
    blurbZh: "赫爾辛基的白教堂",
    number: 4,
    phase: "city",
    titleEn: "Helsinki Cathedral",
    titleZh: "主教座堂",
  },
  {
    blurbEn: "The city's sea, then further south",
    blurbZh: "城裡的海、再往南",
    number: 5,
    phase: "city",
    titleEn: "South Harbour",
    titleZh: "南港",
  },
];

export const LAPLAND_POSTER_TITLE = {
  kickerZh: "十二月 · 深冬",
  kickerEn: "December · midwinter",
  routeEn: "Santa Claus Village → Helsinki",
  routeZh: "聖誕老人村，然後往南",
  seasonEn: "Christmas window",
  seasonZh: "聖誕季窗口",
  titleEn: "Lapland · Helsinki",
  titleZh: "拉普蘭 · 赫爾辛基",
} as const;

export const LAPLAND_ARCTIC_LATITUDE = 66.5436;
export const LAPLAND_HELSINKI: GeoPoint = { latitude: 60.1699, longitude: 24.9384 };
export const LAPLAND_HELSINKI_CATHEDRAL: GeoPoint = { latitude: 60.1704, longitude: 24.9521 };
export const LAPLAND_HELSINKI_HARBOUR: GeoPoint = { latitude: 60.1666, longitude: 24.9575 };

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

export type PosterLegendItem = {
  blurb: string;
  blurbEn: string;
  height: number;
  id: string;
  label: string;
  number: number;
  phase: LaplandPosterPhase;
  sublabel: string | null;
  width: number;
  x: number;
  y: number;
};

export type PosterLayout = {
  arcticPath: PosterPoint[];
  bounds: TileBounds;
  cityLabel: string;
  legendItems: PosterLegendItem[];
  legendRatio: number;
  legs: PosterLeg[];
  longHaulLabel: string | null;
  mapRatio: number;
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
const LAPLAND_ARCTIC_DISPLAY: GeoPoint = { latitude: 66.5534, longitude: 25.8216 };
export const LAPLAND_CITY: GeoPoint = { latitude: 66.5039, longitude: 25.7294 };

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
  const santa = findPlace(places, ["place_lapland_santa_village", "Santa Claus Village"]);
  const arctic = findPlace(places, ["place_lapland_arctic_circle", "Arctic Circle Line"]);
  const cabin = findPlace(places, ["place_lapland_rovaniemi", "place_lapland_cabin", "Rovaniemi", "Red cabin no. 4"]);
  const helsinki = findPlace(places, ["place_lapland_helsinki", "Helsinki"]);
  const arcticJournal = findJournal(journalEntries, ["journal_lapland_arctic", "arctic circle", "北極圈"]);
  const cabinJournal = findJournal(journalEntries, ["journal_lapland_cabin", "red cabin", "4 號"]);
  const arcticPhoto = findPhoto(photos, ["photo_lapland_still_g", "photo_lapland_dump_arctic_sign", "photo_lapland_arctic_circle"]);
  const santaPhoto = findPhoto(photos, ["photo_lapland_still_cover", "photo_lapland_still_h", "photo_lapland_dump_arctic_pillars"]);
  const cabinPhoto = findPhoto(photos, ["photo_lapland_still_l", "photo_lapland_dump_cabin4", "photo_lapland_snow_cabin"]);
  const cathedralPhoto = findPhoto(photos, ["photo_lapland_garnish_cathedral"]);
  const harbourPhoto = findPhoto(photos, ["photo_lapland_garnish_harbour"]);
  const santaPoint = santa?.coordinates ?? { latitude: 66.5436, longitude: 25.8472 };
  const arcticPoint = arctic && pointSpan(arctic.coordinates ?? santaPoint, santaPoint) > 0.004 ? (arctic.coordinates as GeoPoint) : LAPLAND_ARCTIC_DISPLAY;
  const cabinPoint = cabin?.coordinates ?? { latitude: 66.5424, longitude: 25.8448 };
  const cathedralPoint = cathedralPhoto?.coordinates ?? LAPLAND_HELSINKI_CATHEDRAL;
  const harbourPoint = harbourPhoto?.coordinates ?? LAPLAND_HELSINKI_HARBOUR;

  const regionalStops: ItineraryStop[] = [
    {
      dateLabel: null,
      icon: "village",
      id: santa?.id ?? "stop_lapland_santa",
      leg: "winter",
      linkedJournalEntryId: null,
      linkedPhotoId: santaPhoto?.id ?? arcticJournal?.storyPhotoId ?? null,
      listLabel: "聖誕老人村 / Santa Claus Village",
      note: santa?.notes ?? arcticJournal?.body ?? null,
      number: 1,
      point: santaPoint,
      title: "聖誕老人村 / Santa Claus Village",
    },
    {
      dateLabel: null,
      icon: "circle",
      id: arctic?.id ?? "stop_lapland_arctic",
      leg: "winter",
      linkedJournalEntryId: arcticJournal?.id ?? null,
      linkedPhotoId: arcticPhoto?.id ?? null,
      listLabel: "北極圈 / Arctic Circle",
      note: arctic?.notes ?? arcticPhoto?.caption ?? null,
      number: 2,
      point: arcticPoint,
      title: "北極圈 / Arctic Circle",
    },
    {
      dateLabel: null,
      icon: "cabin",
      id: cabin?.id ?? "stop_lapland_rovaniemi",
      leg: "winter",
      linkedJournalEntryId: null,
      linkedPhotoId: cabinPhoto?.id ?? cabinJournal?.storyPhotoId ?? null,
      listLabel: "羅瓦涅米 / Rovaniemi",
      note: cabin?.notes ?? "村裡過夜的基地。 / The base for a night in the village.",
      number: 3,
      point: cabin?.coordinates ?? LAPLAND_CITY,
      title: "羅瓦涅米 / Rovaniemi",
    },
    {
      dateLabel: null,
      icon: "cathedral",
      id: cathedralPhoto?.id ?? "stop_lapland_cathedral",
      leg: "side",
      linkedJournalEntryId: null,
      linkedPhotoId: cathedralPhoto?.id ?? null,
      listLabel: "赫爾辛基主教座堂 / Helsinki Cathedral",
      note: "冬日的赫爾辛基主教座堂。 / Helsinki Cathedral in winter.",
      number: 4,
      point: cathedralPoint,
      title: "赫爾辛基主教座堂 / Helsinki Cathedral",
    },
    {
      dateLabel: null,
      icon: "harbour",
      id: harbourPhoto?.id ?? "stop_lapland_harbour",
      leg: "side",
      linkedJournalEntryId: null,
      linkedPhotoId: harbourPhoto?.id ?? null,
      listLabel: "南港 / South Harbour",
      note: "冬日南港。 / South Harbour in winter.",
      number: 5,
      point: harbourPoint,
      title: "南港 / South Harbour",
    },
  ];

  const regionalLegs: RegionalLeg[] = [
    { from: santaPoint, id: "leg_santa_arctic", kind: "winter", style: "solid", to: arcticPoint },
    { from: santaPoint, id: "leg_santa_cabin", kind: "winter", style: "solid", to: cabinPoint },
    { from: cabinPoint, id: "leg_cabin_helsinki", kind: "winter", style: "solid", to: helsinki?.coordinates ?? LAPLAND_HELSINKI },
    { from: cathedralPoint, id: "leg_cathedral_harbour", kind: "side", style: "dotted", to: harbourPoint },
  ];

  return {
    arrival: [
      { id: "arrival_rvn", label: "Rovaniemi", shortLabel: "RVN" },
      { id: "arrival_hel", label: "Helsinki", shortLabel: "HEL" },
    ],
    regionalLegs,
    regionalPoints: [...regionalStops.map((stop) => stop.point), LAPLAND_CITY, LAPLAND_HELSINKI],
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

export function getLaplandPictureBounds(points: GeoPoint[] = []): TileBounds {
  void points;
  const zoom = LAPLAND_POSTER_FRAME.zoom;

  return {
    maxX: longitudeToTileX(LAPLAND_POSTER_FRAME.maxLng, zoom),
    maxY: latitudeToTileY(LAPLAND_POSTER_FRAME.minLat, zoom),
    minX: longitudeToTileX(LAPLAND_POSTER_FRAME.minLng, zoom),
    minY: latitudeToTileY(LAPLAND_POSTER_FRAME.maxLat, zoom),
    zoom,
  };
}

export const WINTER_PICTURE_ORDER = [1, 2, 3, 4];
export const SIDE_PICTURE_ORDER = [4, 5];
export const LAPLAND_JOURNEY_ORDER = [1, 3, 4, 5];

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
    sublabel: item.number === 1 && item.listLabel.includes("聖誕老人村") ? "聖誕老人村" : null,
    x: Math.min(94, Math.max(6, item.position.x)),
    y: Math.min(92, Math.max(8, item.position.y)),
  }));
}

export function buildPosterLayout(itinerary: JourneyItinerary, city = "Rovaniemi"): PosterLayout {
  const points = itinerary.regionalPoints.length > 0 ? itinerary.regionalPoints : itinerary.regionalStops.map((stop) => stop.point);
  const fallback = points.length > 0 ? points : [{ latitude: 66.5039, longitude: 25.7294 }];
  const lapland = isLaplandPosterCity(city);
  const bounds = lapland ? getLaplandPictureBounds(fallback) : getTileBounds(fallback, "regional");
  const pins = lapland ? composeLaplandPosterPins(itinerary.regionalStops, bounds) : spaceItineraryPins(itinerary.regionalStops, bounds);
  const projectPoint = lapland
    ? (point: GeoPoint) => projectOntoLaplandPoster(point, bounds)
    : (point: GeoPoint) => projectRaw(point, bounds);

  return {
    arcticPath: lapland ? arcticCirclePosterPath(bounds) : [],
    bounds,
    cityLabel: lapland ? "Lapland · Helsinki" : `${city} · itinerary`,
    legendItems: lapland ? buildLaplandLegendItems(pins) : [],
    legendRatio: lapland ? LAPLAND_POSTER_LEGEND_RATIO : 0,
    legs: itinerary.regionalLegs.map((leg) => ({
      from: projectPoint(leg.from),
      id: leg.id,
      kind: leg.kind,
      style: leg.style,
      to: projectPoint(leg.to),
    })),
    longHaulLabel: lapland ? "Santa Claus Village · Helsinki" : formatLongHaulLabel(itinerary.arrival),
    mapRatio: lapland ? LAPLAND_POSTER_MAP_RATIO : 1,
    pins,
    sidePath: pathFromPinOrder(pins, SIDE_PICTURE_ORDER),
    winterPath: pathFromPinOrder(pins, lapland ? LAPLAND_JOURNEY_ORDER : WINTER_PICTURE_ORDER),
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

export function getLaplandPosterRasterSize(bounds: TileBounds) {
  const map = getPosterRasterSize(bounds);
  return {
    height: map.height,
    mapWidth: map.width,
    width: Math.max(1, Math.round(map.width / LAPLAND_POSTER_MAP_RATIO)),
  };
}

export function projectOntoLaplandPoster(point: GeoPoint, bounds: TileBounds): PosterPoint {
  const raw = projectRaw(point, bounds);
  return {
    x: LAPLAND_POSTER_LEGEND_RATIO * 100 + raw.x * LAPLAND_POSTER_MAP_RATIO,
    y: raw.y,
  };
}

export function arcticCirclePosterPath(bounds: TileBounds): PosterPoint[] {
  const longitudes = [20.8, 22.6, 24.4, 26.2, 28.0, 29.6, 30.8];
  return longitudes.map((longitude) => projectOntoLaplandPoster({ latitude: LAPLAND_ARCTIC_LATITUDE, longitude }, bounds));
}

const LAPLAND_PIN_OFFSETS: Record<number, PosterPoint> = {
  1: { x: 4.6, y: 2.2 },
  2: { x: -5.8, y: -4.8 },
  3: { x: -8.4, y: 7.2 },
  4: { x: -7.4, y: -4.4 },
  5: { x: 6.8, y: 3.2 },
};

export function posterChineseLabel(stop: ItineraryStop) {
  if (!stop.listLabel.includes(" / ")) {
    return null;
  }

  return stop.listLabel.split(" / ")[0]?.trim() || null;
}

export function composeLaplandPosterPins(stops: ItineraryStop[], bounds: TileBounds): PosterPin[] {
  const mapLeft = LAPLAND_POSTER_LEGEND_RATIO * 100;
  const mapRight = 97.2;

  return stops.map((stop) => {
    const projected = projectOntoLaplandPoster(stop.point, bounds);
    const offset = LAPLAND_PIN_OFFSETS[stop.number] ?? { x: 0, y: 0 };
    const note = LAPLAND_POSTER_NOTES.find((entry) => entry.number === stop.number);
    return {
      id: stop.id,
      label: note?.titleEn ?? posterShortLabel(stop),
      leg: stop.leg,
      number: stop.number,
      point: stop.point,
      sublabel: note?.titleZh ?? posterChineseLabel(stop),
      x: Math.min(mapRight, Math.max(mapLeft + 6.5, projected.x + offset.x)),
      y: Math.min(93, Math.max(7, projected.y + offset.y)),
    };
  });
}

export function buildLaplandLegendItems(pins: PosterPin[]): PosterLegendItem[] {
  const x = 1.7;
  const width = 26.6;
  const height = 8.0;
  const christmasY = [15.5, 24.1, 32.7];
  const cityY = [45.0, 53.6];

  return pins.map((pin) => {
    const note = LAPLAND_POSTER_NOTES.find((entry) => entry.number === pin.number);
    const y = pin.number <= 3 ? christmasY[pin.number - 1] : cityY[pin.number - 4];
    return {
      blurb: note?.blurbZh ?? "",
      blurbEn: note?.blurbEn ?? "",
      height,
      id: pin.id,
      label: note?.titleZh ?? pin.sublabel ?? pin.label,
      number: pin.number,
      phase: note?.phase ?? (pin.number <= 3 ? "christmas" : "city"),
      sublabel: note?.titleEn ?? pin.label,
      width,
      x,
      y,
    };
  });
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
