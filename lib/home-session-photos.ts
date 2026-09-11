import type { CoffeePhoto, CoffeeShop, Photo, TripDetail } from "@/lib/types";

/** Home carousels show one photo at a time. Never dump every trip/shop photo into HTML. */
export const HOME_SESSION_PHOTO_LIMIT = 8;

export type HomeSessionPhoto = {
  alt: string;
  src: string;
};

type SessionPhotoSource = {
  caption?: string | null;
  id?: string;
  storageKey: string;
};

function isRenderablePhoto(photo: SessionPhotoSource) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function toSessionPhoto(photo: SessionPhotoSource, fallbackAlt: string): HomeSessionPhoto {
  return {
    alt: photo.caption ?? fallbackAlt,
    src: photo.storageKey,
  };
}

export function pickHomeSessionPhotos(
  groups: Array<{ coverId?: string | null; label: string; photos: SessionPhotoSource[] }>,
  limit = HOME_SESSION_PHOTO_LIMIT,
): HomeSessionPhoto[] {
  const cap = Math.max(0, limit);
  const seen = new Set<string>();
  const picked: HomeSessionPhoto[] = [];

  function add(photo: HomeSessionPhoto | undefined) {
    if (!photo || picked.length >= cap || seen.has(photo.src)) {
      return;
    }
    seen.add(photo.src);
    picked.push(photo);
  }

  const extras: HomeSessionPhoto[][] = [];
  for (const group of groups) {
    const renderable = group.photos.filter(isRenderablePhoto);
    const cover =
      (group.coverId ? renderable.find((photo) => photo.id === group.coverId) : undefined) ?? renderable[0];
    add(cover ? toSessionPhoto(cover, group.label) : undefined);
    extras.push(
      renderable
        .filter((photo) => photo !== cover)
        .map((photo) => toSessionPhoto(photo, group.label)),
    );
  }

  let round = 0;
  let progressed = true;
  while (picked.length < cap && progressed) {
    progressed = false;
    for (const groupExtras of extras) {
      if (picked.length >= cap) {
        break;
      }
      const photo = groupExtras[round];
      if (!photo) {
        continue;
      }
      const before = picked.length;
      add(photo);
      if (picked.length > before) {
        progressed = true;
      }
    }
    round += 1;
  }

  return picked;
}

export function getTravelSessionPhotos(trips: TripDetail[], limit = HOME_SESSION_PHOTO_LIMIT) {
  return pickHomeSessionPhotos(
    trips.map((trip) => ({
      coverId: trip.coverPhotoId,
      label: trip.title,
      photos: trip.photos as Photo[],
    })),
    limit,
  );
}

export function getCoffeeSessionPhotos(shops: CoffeeShop[], limit = HOME_SESSION_PHOTO_LIMIT) {
  return pickHomeSessionPhotos(
    shops.map((shop) => ({
      coverId: shop.photos[0]?.id ?? null,
      label: shop.name,
      photos: shop.photos as CoffeePhoto[],
    })),
    limit,
  );
}
