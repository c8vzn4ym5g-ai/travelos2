import type { MomentPhoto, PhotoCaptureMetadata } from "./types.ts";

/** EXIF is evidence from the uploaded bytes, not a guarantee the camera clock was correct. */
export async function readOriginalCaptureMetadata(original: Blob): Promise<PhotoCaptureMetadata | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      (async () => {
        const { default: exifr } = await import("exifr");
        const tags = await exifr.parse(new Uint8Array(await original.arrayBuffer()), {
          pick: ["DateTimeOriginal", "OffsetTimeOriginal", "GPSLatitude", "GPSLongitude", "GPSLatitudeRef", "GPSLongitudeRef"],
          reviveValues: false, xmp: false, icc: false, iptc: false, jfif: false,
        });
        if (!tags) return null;
        const raw = typeof tags.DateTimeOriginal === "string" ? tags.DateTimeOriginal.trim() : "";
        const local = raw.replace(/^(\d{4}):(\d{2}):(\d{2}) /, "$1-$2-$3T");
        const localDate = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(local) ? new Date(`${local}Z`) : null;
        const localTakenAt = localDate && Number.isFinite(localDate.getTime()) && localDate.toISOString().slice(0, 19) === local ? local : null;
        const rawOffset = typeof tags.OffsetTimeOriginal === "string" ? tags.OffsetTimeOriginal.trim() : "";
        const offset = /^[+-](?:0\d|1[0-4]):[0-5]\d$/.test(rawOffset) ? rawOffset : null;
        const instant = localTakenAt && offset ? new Date(`${localTakenAt}${offset}`) : null;
        const takenAt = instant && Number.isFinite(instant.getTime()) ? instant.toISOString() : null;
        const lat = tags.latitude, lon = tags.longitude;
        const coordinates = typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
          ? { latitude: lat, longitude: lon } : null;
        if (!localTakenAt && !coordinates) return null;
        return { source: "exif" as const, localTakenAt, takenAt, offset, coordinates };
      })(),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 1500); }),
    ]);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function captureMetadataPhotoFields(metadata: PhotoCaptureMetadata | null): Partial<MomentPhoto> {
  return metadata ? { captureMetadata: metadata, captureMetadataStatus: "verified", takenAt: metadata.takenAt, coordinates: metadata.coordinates } : {};
}
