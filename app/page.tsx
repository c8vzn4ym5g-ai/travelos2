import Link from "next/link";
import { getCoffeeShopsByVisitDate, getCoffeeStats } from "@/lib/coffee";
import { readCoffeeContent } from "@/lib/coffee-store";
import { readContent } from "@/lib/editable-store";
import type { CoffeePhoto, CoffeeShopListItem, Photo, TripDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

const travelStats = [
  { label: "Countries", value: "18" },
  { label: "Cities", value: "87" },
  { label: "Travel days", value: "196" },
  { label: "Journal entries", value: "152" },
];

const sessions = [
  {
    eyebrow: "Travel Journal",
    title: "Trips, routes, and long-form memories",
    description:
      "Keep journeys, daily notes, places, photos, and trip costs in the original TravelOS journal area.",
    href: "/trips",
    action: "Open travel",
    secondaryHref: "/trips/new",
    secondaryAction: "New trip draft",
  },
  {
    eyebrow: "Coffee Map",
    title: "Coffee shops, taste notes, and life moments",
    description:
      "Collect cafes across countries without mixing them into trip journals. Add links, photos, comments, and personal notes from the shop.",
    href: "/coffee",
    action: "Open coffee map",
    secondaryHref: "/coffee/new",
    secondaryAction: "Add coffee shop",
  },
  {
    eyebrow: "Drive",
    title: "Car rental and road-trip booking tools",
    description:
      "Open the Travelpayouts Drive workspace for rental-car searches and road-trip planning without mixing it into journals or coffee notes.",
    href: "/drive",
    action: "Open Drive",
    secondaryHref: "/trips",
    secondaryAction: "Back to trips",
  },
];

function isRenderablePhoto(photo: Photo | CoffeePhoto) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function getTripCoverPhoto(trip: TripDetail) {
  return (
    trip.photos.find((photo) => photo.id === trip.coverPhotoId && isRenderablePhoto(photo)) ??
    trip.photos.find(isRenderablePhoto) ??
    null
  );
}

function getCoffeeCoverPhoto(shop: CoffeeShopListItem) {
  return shop.coverPhoto;
}

function SessionCard({
  action,
  description,
  eyebrow,
  href,
  photos,
  secondaryAction,
  secondaryHref,
  title,
}: {
  action: string;
  description: string;
  eyebrow: string;
  href: string;
  photos: { alt: string; src: string }[];
  secondaryAction: string;
  secondaryHref: string;
  title: string;
}) {
  const visiblePhotos = photos.slice(0, 3);
  const primaryPhoto = visiblePhotos[0];
  const supportingPhotos = visiblePhotos.slice(1);

  return (
    <article className="flex min-h-[32rem] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
      <Link className="block border-b border-zinc-100 bg-stone-100 p-1" href={href}>
        {primaryPhoto ? (
          <div className="grid gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt={primaryPhoto.alt} className="h-44 w-full rounded-lg object-cover" src={primaryPhoto.src} />
            {supportingPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-1">
                {supportingPhotos.map((photo, index) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    alt={photo.alt}
                    className="h-20 w-full rounded-md object-cover"
                    key={`${photo.src}-${index}`}
                    src={photo.src}
                  />
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid h-64 place-items-center rounded-lg border border-zinc-200 bg-gradient-to-br from-slate-100 via-stone-50 to-amber-50 px-6 text-center text-sm text-zinc-500">
            Visual preview coming soon
          </div>
        )}
      </Link>
      <div className="flex flex-1 flex-col p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-700">{eyebrow}</p>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-zinc-950">{title}</h2>
        <p className="mt-3 flex-1 text-sm leading-6 text-zinc-600">{description}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2.5 text-center text-sm font-semibold text-white" href={href}>
            {action}
          </Link>
          <Link className="rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-zinc-950" href={secondaryHref}>
            {secondaryAction}
          </Link>
        </div>
      </div>
    </article>
  );
}

function LatestCoffeeItem({ shop }: { shop: CoffeeShopListItem }) {
  const coverPhoto = getCoffeeCoverPhoto(shop);

  return (
    <article className="grid gap-3 border-b border-zinc-100 pb-4 last:border-0 last:pb-0 sm:grid-cols-[5.5rem_1fr]">
      <Link className="overflow-hidden rounded-md bg-stone-100" href={`/coffee/${shop.slug}`}>
        {coverPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={coverPhoto.caption ?? shop.name} className="h-24 w-full object-cover" src={coverPhoto.storageKey} />
        ) : (
          <div className="grid h-24 place-items-center px-2 text-center text-xs text-zinc-500">No photo</div>
        )}
      </Link>
      <div>
        <p className="font-medium">{shop.name}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {shop.city}, {shop.country} / {shop.coffeeOrdered}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{shop.lifeNote}</p>
      </div>
    </article>
  );
}

function LatestTripItem({ trip }: { trip: TripDetail }) {
  const coverPhoto = getTripCoverPhoto(trip);

  return (
    <article className="grid gap-3 border-b border-zinc-100 pb-4 last:border-0 last:pb-0 sm:grid-cols-[5.5rem_1fr]">
      <Link className="overflow-hidden rounded-md bg-stone-100" href={`/trips/${trip.slug}`}>
        {coverPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={coverPhoto.caption ?? trip.title} className="h-24 w-full object-cover" src={coverPhoto.storageKey} />
        ) : (
          <div className="grid h-24 place-items-center px-2 text-center text-xs text-zinc-500">No photo</div>
        )}
      </Link>
      <div>
        <p className="font-medium">{trip.title}</p>
        <p className="mt-1 text-sm text-zinc-500">
          {trip.city}, {trip.country}
        </p>
        <p className="mt-2 text-sm leading-6 text-zinc-600">{trip.summary}</p>
      </div>
    </article>
  );
}

export default async function Home() {
  const { content: travelContent } = await readContent();
  const { content: coffeeContent } = await readCoffeeContent();
  const coffeeStats = getCoffeeStats(coffeeContent.shops);
  const trips = [...travelContent.trips].sort((first, second) => second.startDate.localeCompare(first.startDate));
  const publicTrips = trips.filter((trip) => trip.visibility !== "private");
  const visibleTrips = (publicTrips.length > 0 ? publicTrips : trips).slice(0, 3);
  const latestCoffee = getCoffeeShopsByVisitDate(coffeeContent.shops).slice(0, 3);
  const travelPhotoStrip = visibleTrips
    .map((trip) => {
      const photo = getTripCoverPhoto(trip);
      return photo
        ? {
            alt: photo.caption ?? trip.title,
            href: `/trips/${trip.slug}`,
            label: trip.city,
            src: photo.storageKey,
          }
        : null;
    })
    .filter((item): item is { alt: string; href: string; label: string; src: string } => Boolean(item));
  const coffeePhotoStrip = latestCoffee
    .map((shop) => {
      const photo = getCoffeeCoverPhoto(shop);
      return photo
        ? {
            alt: photo.caption ?? shop.name,
            href: `/coffee/${shop.slug}`,
            label: shop.city,
            src: photo.storageKey,
          }
        : null;
    })
    .filter((item): item is { alt: string; href: string; label: string; src: string } => Boolean(item));
  const sessionPhotosByHref: Record<string, { alt: string; src: string }[]> = {
    "/coffee": coffeePhotoStrip.map((item) => ({ alt: item.alt, src: item.src })),
    "/drive": [],
    "/trips": travelPhotoStrip.map((item) => ({ alt: item.alt, src: item.src })),
  };

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-8 lg:px-10">
          <nav className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-amber-700">TravelOS</p>
              <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
                Your travel and coffee memory system.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
                Two separate workspaces on one first page: Travel Journal for trips, Coffee Map for cafes, taste notes,
                photos, and the life moments that happen between destinations.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800" href="/trips">
                Travel
              </Link>
              <Link className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800" href="/coffee">
                Coffee
              </Link>
              <Link className="rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-white" href="/drive">
                Drive
              </Link>
            </div>
          </nav>
          <div className="grid gap-4 xl:grid-cols-3">
            {sessions.map((session) => (
              <SessionCard key={session.eyebrow} photos={sessionPhotosByHref[session.href] ?? []} {...session} />
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1fr_1fr] lg:px-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Travel Journal</p>
              <h2 className="mt-2 text-2xl font-semibold">Latest journeys</h2>
            </div>
            <Link className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-950" href="/trips">
              View all
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {visibleTrips.map((trip) => (
              <LatestTripItem key={trip.id} trip={trip} />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {travelStats.map((item) => (
              <div className="rounded-md border border-zinc-200 bg-white px-3 py-3" key={item.label}>
                <p className="text-xl font-semibold">{item.value}</p>
                <p className="mt-1 text-xs text-zinc-500">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-amber-700">Coffee Map</p>
              <h2 className="mt-2 text-2xl font-semibold">Latest coffee notes</h2>
            </div>
            <Link className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-950" href="/coffee">
              View map
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {latestCoffee.map((shop) => (
              <LatestCoffeeItem key={shop.id} shop={shop} />
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
              <p className="text-xl font-semibold">{coffeeStats.shops}</p>
              <p className="mt-1 text-xs text-zinc-500">Shops</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
              <p className="text-xl font-semibold">{coffeeStats.countries}</p>
              <p className="mt-1 text-xs text-zinc-500">Countries</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
              <p className="text-xl font-semibold">{coffeeStats.cities}</p>
              <p className="mt-1 text-xs text-zinc-500">Cities</p>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
              <p className="text-xl font-semibold">{coffeeStats.photos}</p>
              <p className="mt-1 text-xs text-zinc-500">Photos</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
