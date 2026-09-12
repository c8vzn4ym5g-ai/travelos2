import type { MomentPhoto } from "./types.ts";

type Gps = Readonly<{ latitude: number; longitude: number }>;

export type PhotoProvenance = Readonly<{
  photoId: string;
  capture?: Readonly<{
    source: "exif";
    /** ISO instant with offset, or EXIF local time with an explicitly verified timezone. */
    takenAt?: string;
    timeZone?: string;
    gps?: Gps;
    /** These labels must be resolved from capture GPS, never upload GPS. */
    countryCode?: string;
    placeId?: string;
  }>;
  upload?: Readonly<{ uploadedAt: string; gps?: Gps; countryCode?: string }>;
  /** Human-confirmed assignment, not the trip selected in an upload screen. */
  manualTripId?: string;
  neighboringTripId?: string;
}>;

export type PhotoTrip = Readonly<{
  id: string;
  startDay: string;
  endDay: string;
  timeZone: string;
  countryCodes: readonly string[];
}>;

/** Bridge stored photos into grouping. Legacy coordinates/time never become EXIF.
 * Labels must come from a lookup of this capture GPS or explicit human review.
 */
export function provenanceFromMomentPhoto(photo: MomentPhoto, confirmed?: {
  countryCode?: string; placeId?: string; captureTimeZone?: string; manualTripId?: string;
}): PhotoProvenance {
  const metadata = photo.captureMetadataStatus === "verified" && photo.captureMetadata?.source === "exif" ? photo.captureMetadata : null;
  return {
    photoId: photo.id,
    manualTripId: confirmed?.manualTripId,
    upload: { uploadedAt: photo.createdAt, gps: photo.uploadCoordinates ?? undefined },
    ...(metadata ? { capture: {
      source: "exif" as const,
      takenAt: metadata.takenAt ?? metadata.localTakenAt ?? undefined,
      gps: metadata.coordinates ?? undefined,
      timeZone: confirmed?.captureTimeZone,
      countryCode: confirmed?.countryCode,
      placeId: confirmed?.placeId,
    } } : {}),
  };
}

type Reason = "missing-capture-time" | "missing-capture-location" | "date-conflict" | "country-conflict" | "manual-trip-conflict" | "unresolved-timezone" | "invalid-trip-range";
export type PhotoGroupingDecision = {
  status: "review" | "suggested" | "confirmed";
  tripId: string | null;
  captureDay: string | null;
  placeId: string | null;
  reasons: Reason[];
};

function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const date = new Date(`${day}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

function dayInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  return ["year", "month", "day"].map((key) => parts.find((part) => part.type === key)!.value).join("-");
}

function captureDay(capture: PhotoProvenance["capture"], timeZone: string): { day: string | null; reason?: Reason } {
  if (!capture?.takenAt) return { day: null, reason: "missing-capture-time" };
  const value = capture.takenAt.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T");
  if (!validDay(value.slice(0, 10))) return { day: null, reason: "missing-capture-time" };
  try {
    if (/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
      const date = new Date(value);
      if (!Number.isFinite(date.getTime())) return { day: null, reason: "missing-capture-time" };
      return { day: dayInZone(date, timeZone) };
    }
    // Local EXIF time has no instant. Do not silently assume the phone's current zone.
    if (!capture.timeZone || capture.timeZone !== timeZone) return { day: null, reason: "unresolved-timezone" };
    if (!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)) return { day: null, reason: "missing-capture-time" };
    dayInZone(new Date("2000-01-01T00:00:00Z"), timeZone);
    return { day: value.slice(0, 10) };
  } catch {
    return { day: null, reason: "unresolved-timezone" };
  }
}

/** Pure recommendation. No writes, EXIF changes, geocoding, or neighbor-based confirmation. */
export function decidePhotoGroup(photo: PhotoProvenance, trip: PhotoTrip): PhotoGroupingDecision {
  const time = captureDay(photo.capture, trip.timeZone);
  const reasons: Reason[] = time.reason ? [time.reason] : [];
  const gps = photo.capture?.gps;
  const country = photo.capture?.countryCode?.toUpperCase();
  const hasLocation = Boolean(gps && Number.isFinite(gps.latitude) && Math.abs(gps.latitude) <= 90 && Number.isFinite(gps.longitude) && Math.abs(gps.longitude) <= 180 && country);
  if (!hasLocation) reasons.push("missing-capture-location");
  else if (!trip.countryCodes.map((code) => code.toUpperCase()).includes(country!)) reasons.push("country-conflict");
  if (!validDay(trip.startDay) || !validDay(trip.endDay) || trip.startDay > trip.endDay) reasons.push("invalid-trip-range");
  else if (time.day && (time.day < trip.startDay || time.day > trip.endDay)) reasons.push("date-conflict");
  if (photo.manualTripId && photo.manualTripId !== trip.id) reasons.push("manual-trip-conflict");
  const conflict = reasons.some((reason) => ["country-conflict", "date-conflict", "manual-trip-conflict", "invalid-trip-range"].includes(reason));
  const confirmed = photo.manualTripId === trip.id && !conflict;
  const status = confirmed ? "confirmed" : reasons.length ? "review" : "suggested";
  return {
    status, tripId: status === "review" ? null : trip.id,
    captureDay: time.day,
    placeId: hasLocation ? photo.capture?.placeId ?? null : null,
    reasons,
  };
}
