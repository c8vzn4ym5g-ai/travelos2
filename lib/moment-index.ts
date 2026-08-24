import type { GeoPoint, TravelMoment } from "@/lib/types";

export const TRAVEL_CALENDAR_TIME_ZONE = "Asia/Taipei";

export type KnownPlace = {
  label: string;
  latitude: number;
  longitude: number;
};

const PLACE_MATCH_KM = 75;

export const DEFAULT_KNOWN_PLACES: KnownPlace[] = [
  { label: "Rovaniemi", latitude: 66.5039, longitude: 25.7294 },
  { label: "Helsinki", latitude: 60.3172, longitude: 24.9633 },
  { label: "Hong Kong", latitude: 22.308, longitude: 113.9185 },
  { label: "Sapporo", latitude: 43.0618, longitude: 141.3545 },
  { label: "Bangkok", latitude: 13.7563, longitude: 100.5018 },
  { label: "Paris", latitude: 48.8566, longitude: 2.3522 },
  { label: "London", latitude: 51.5072, longitude: -0.1276 },
];

export function calendarDayInTimeZone(iso: string, timeZone = TRAVEL_CALENDAR_TIME_ZONE) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso.slice(0, 10);
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return iso.slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

export function shiftCalendarDay(day: string, deltaDays: number) {
  const [year, month, date] = day.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, date + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

export function momentCapturedAt(moment: Pick<TravelMoment, "createdAt" | "photos" | "time">) {
  const photoTime = moment.photos.find((photo) => photo.takenAt)?.takenAt;
  return moment.time || photoTime || moment.createdAt;
}

export function momentCalendarDay(moment: Pick<TravelMoment, "createdAt" | "photos" | "time">) {
  return calendarDayInTimeZone(momentCapturedAt(moment));
}

export function momentCoordinates(moment: Pick<TravelMoment, "coordinates" | "photos">): GeoPoint | null {
  return moment.coordinates ?? moment.photos.find((photo) => photo.coordinates)?.coordinates ?? null;
}

function distanceKm(from: GeoPoint, to: KnownPlace) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRad(to.latitude - from.latitude);
  const longitudeDelta = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRad(from.latitude)) * Math.cos(toRad(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function placeLabelFromCoordinates(point: GeoPoint, knownPlaces: KnownPlace[] = DEFAULT_KNOWN_PLACES) {
  let nearest: KnownPlace | null = null;
  let nearestKm = Number.POSITIVE_INFINITY;

  for (const place of knownPlaces) {
    const km = distanceKm(point, place);
    if (km < nearestKm) {
      nearest = place;
      nearestKm = km;
    }
  }

  if (nearest && nearestKm <= PLACE_MATCH_KM) {
    return nearest.label;
  }

  return `${point.latitude.toFixed(2)}, ${point.longitude.toFixed(2)}`;
}

export function momentPlaceLabels(moment: Pick<TravelMoment, "coordinates" | "photos" | "place">) {
  if (moment.place.length > 0) {
    return moment.place;
  }

  const coordinates = momentCoordinates(moment);
  return coordinates ? [placeLabelFromCoordinates(coordinates)] : [];
}

export function indexTravelMoment(moment: TravelMoment, knownPlaces: KnownPlace[] = DEFAULT_KNOWN_PLACES): TravelMoment {
  const capturedAt = momentCapturedAt(moment);
  const coordinates = momentCoordinates(moment);
  const place = moment.place.length > 0 ? moment.place : coordinates ? [placeLabelFromCoordinates(coordinates, knownPlaces)] : [];

  return {
    ...moment,
    coordinates: coordinates ?? moment.coordinates,
    place,
    time: moment.time || capturedAt,
  };
}

export function filterMomentsByDayAndPlace(
  moments: TravelMoment[],
  filters: { day?: string; place?: string } = {},
) {
  const day = filters.day?.trim() ?? "";
  const place = filters.place?.trim() ?? "";

  return moments.filter((moment) => {
    if (day && momentCalendarDay(moment) !== day) {
      return false;
    }

    if (place && !momentPlaceLabels(moment).includes(place)) {
      return false;
    }

    return true;
  });
}

export function warehouseDays(moments: TravelMoment[]) {
  return [...new Set(moments.map(momentCalendarDay))].sort((first, second) => second.localeCompare(first));
}

export function warehousePlaces(moments: TravelMoment[]) {
  return [...new Set(moments.flatMap(momentPlaceLabels))].sort((first, second) => first.localeCompare(second));
}
