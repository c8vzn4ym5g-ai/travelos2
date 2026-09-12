import type { GeoPoint, MomentPhoto } from "./types.ts";

function valid(point: GeoPoint | null | undefined): point is GeoPoint {
  return Boolean(point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180);
}

/** Distance is a review signal, not a country lookup or proof of wrong assignment. */
export function reviewPhotoDistance(photos: MomentPhoto[], tripMarker: GeoPoint | null | undefined) {
  if (!valid(tripMarker)) return [];
  const rad = Math.PI / 180;
  return photos.flatMap((photo) => {
    const point = photo.captureMetadataStatus === "verified" && photo.captureMetadata?.source === "exif" ? photo.captureMetadata.coordinates : null;
    if (!valid(point)) return [];
    const dLat = (point.latitude - tripMarker.latitude) * rad;
    const dLon = (point.longitude - tripMarker.longitude) * rad;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(point.latitude * rad) * Math.cos(tripMarker.latitude * rad) * Math.sin(dLon / 2) ** 2;
    const distanceKm = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
    return distanceKm > 1500 ? [{ photoId: photo.id, distanceKm }] : [];
  });
}
