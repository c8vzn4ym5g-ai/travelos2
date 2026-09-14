import { isTripPhotoVideo } from '@/lib/trip-photo';
import type { Photo, TripDetail } from '@/lib/types';

export function tripCover(trip: TripDetail): Photo | null {
  const photos = trip.photos.filter(photo => !isTripPhotoVideo(photo) && /^(https?:\/\/|\/)/.test(photo.storageKey));
  return photos.find(photo => photo.id === trip.coverPhotoId) ?? photos[0] ?? null;
}

export function setTripCover(trip: TripDetail, photo: Photo): TripDetail {
  if (isTripPhotoVideo(photo)) return trip;
  return {...trip, coverPhotoId: photo.id, photos: trip.photos.some(item => item.id === photo.id) ? trip.photos : [...trip.photos, photo]};
}
