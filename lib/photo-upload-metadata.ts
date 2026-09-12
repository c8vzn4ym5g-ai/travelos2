import type { MomentPhoto } from "./types.ts";

/** Current upload clients supply device GPS and file modification time, not EXIF.
 * Legacy field names are accepted only as these same unverified sources.
 */
export function photoUploadMetadata(form: FormData): Pick<MomentPhoto, "takenAt" | "coordinates" | "uploadCoordinates" | "fileModifiedAt" | "captureMetadataStatus"> {
  const latitude = String(form.get("uploadLatitude") ?? form.get("latitude") ?? "").trim();
  const longitude = String(form.get("uploadLongitude") ?? form.get("longitude") ?? "").trim();
  const lat = Number(latitude), lon = Number(longitude);
  const uploadCoordinates = latitude && longitude && Number.isFinite(lat) && Math.abs(lat) <= 90 && Number.isFinite(lon) && Math.abs(lon) <= 180
    ? { latitude: lat, longitude: lon } : null;
  const modified = String(form.get("fileModifiedAt") ?? form.get("takenAt") ?? "").trim();
  const date = modified ? new Date(modified) : null;
  return {
    coordinates: null,
    takenAt: null,
    captureMetadataStatus: "unknown",
    uploadCoordinates,
    fileModifiedAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null,
  };
}
