import {getTripPromoVideos,type PromoVideo} from '@/lib/promo-videos';
import {isTripPhotoVideo} from '@/lib/trip-photo';
import type {TripDetail} from './types';
export function journeyVideos(trip:TripDetail):PromoVideo[]{
  return [...trip.photos.filter(isTripPhotoVideo).map(photo=>({src:photo.storageKey,title:photo.caption||photo.originalFilename,caption:photo.caption||'',mood:''})),...getTripPromoVideos(trip.slug)];
}
