import type { TripDetail } from "./types.ts";

/** A save acknowledges the submitted snapshot, never edits made while it was in flight. */
export function reconcileSavedTrips(current: TripDetail[], submitted: TripDetail[], saved: TripDetail[]) {
  const submittedById = new Map(submitted.map(trip => [trip.id, JSON.stringify(trip)]));
  const savedById = new Map(saved.map(trip => [trip.id, trip]));
  const acknowledged: string[] = [];
  const trips = current.map(trip => {
    const result = savedById.get(trip.id);
    if (!result || submittedById.get(trip.id) !== JSON.stringify(trip)) return trip;
    acknowledged.push(trip.id);
    return result;
  });
  return { trips, acknowledged };
}

export function reconcileUploadedPhoto(current: TripDetail[], submitted: TripDetail[], saved: TripDetail[], tripId: string, photoId: string) {
  const result = reconcileSavedTrips(current, submitted, saved);
  const photo = saved.find(trip => trip.id === tripId)?.photos.find(photo => photo.id === photoId);
  if (!photo) return result;
  return { ...result, trips: result.trips.map(trip => trip.id === tripId && !trip.photos.some(item => item.id === photoId)
    ? { ...trip, photos: [...trip.photos, photo] } : trip) };
}
