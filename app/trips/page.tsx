import Link from "next/link";
import { readContent } from "@/lib/editable-store";
import { isTripPublic } from "@/lib/trip-visibility";
import type { Money, Photo, TripDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

const ui = {
  allJourneys: "\u5168\u90e8\u65c5\u7a0b / All journeys",
  intro:
    "\u9019\u88e1\u662f TravelOS \u7684\u65c5\u7a0b\u5165\u53e3\u3002\u6bcf\u4e00\u7bc7\u6587\u7ae0\u90fd\u7528\u81ea\u5df1\u7684\u7db2\u5740\u958b\u555f\uff0c\u4e4b\u5f8c\u65b0\u589e\u65c5\u7a0b\u4e0d\u9700\u8981\u518d\u5efa\u7acb\u56fa\u5b9a\u9801\u9762\u3002",
  read: "\u95b1\u8b80 / Open details",
  timeline: "\u6642\u9593\u7dda / Timeline",
};

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function articleHref(trip: TripDetail) {
  return `/trips/${trip.slug}`;
}

function formatDate(date: string): string {
  return dateFormatter.format(new Date(date));
}

function formatDateRange(startDate: string, endDate: string): string {
  return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

function formatMoney(totalCost: Money | null): string {
  if (!totalCost) {
    return "Not tracked";
  }

  return new Intl.NumberFormat("en", {
    currency: totalCost.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(totalCost.amount);
}

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function getCoverPhoto(trip: TripDetail) {
  return (
    trip.photos.find((photo) => photo.id === trip.coverPhotoId && isRenderablePhoto(photo)) ??
    trip.photos.find(isRenderablePhoto)
  );
}

function TripCard({ trip }: { trip: TripDetail }) {
  const coverPhoto = getCoverPhoto(trip);
  const href = articleHref(trip);

  return (
    <article className="travel-panel grid overflow-hidden rounded-3xl transition hover:-translate-y-0.5 hover:shadow-[0_28px_70px_rgba(20,45,40,0.16)] lg:grid-cols-[14rem_1fr]">
      <Link aria-label={`Open ${trip.title}`} className="block bg-[color:var(--paper-soft)]" href={href}>
        {coverPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={coverPhoto.caption ?? trip.title} className="h-48 w-full object-cover sm:h-56 lg:h-64" src={coverPhoto.storageKey} />
        ) : (
          <div className="grid h-48 place-items-center bg-[color:var(--paper-soft)] p-4 text-sm font-medium text-[color:var(--muted)] sm:h-56 lg:h-64">
            Photo pending
          </div>
        )}
      </Link>

      <div className="p-5 sm:p-7">
        <div className="grid gap-5 xl:grid-cols-[1fr_10rem]">
          <div className="min-w-0">
            <p className="travel-kicker text-xs">
              {trip.country} / {trip.city}
            </p>
            <h2 className="travel-hand mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)] sm:text-3xl">
              <Link href={href}>{trip.title}</Link>
            </h2>
            <p className="travel-muted mt-3 text-sm leading-7">{trip.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm xl:grid-cols-1">
            <div className="travel-soft-panel travel-accent rounded-2xl px-4 py-3">
              <p className="travel-muted text-xs">Rating</p>
              <p className="mt-1 font-semibold text-[color:var(--pine)]">{trip.rating ? `${trip.rating}/5` : "Unrated"}</p>
            </div>
            <div className="travel-soft-panel rounded-2xl px-4 py-3">
              <p className="travel-muted text-xs">Cost</p>
              <p className="mt-1 font-semibold text-[color:var(--pine)]">{formatMoney(trip.totalCost)}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 border-t border-[color:var(--line)] pt-5 text-sm text-[color:var(--muted)] sm:flex-row sm:items-center sm:justify-between">
          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          <Link className="travel-primary inline-flex min-h-11 items-center justify-center rounded-full px-5 py-2 text-center font-semibold sm:px-5 sm:py-2" href={href}>
            {ui.read}
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function TripsPage() {
  const { content } = await readContent();
  const trips = [...content.trips].sort((first, second) => second.startDate.localeCompare(first.startDate));
  const publicTrips = trips.filter(isTripPublic);
  const visibleTrips = publicTrips;

  return (
    <main className="travel-shell">
      <section className="travel-hero">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-9 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="travel-kicker inline-flex min-h-11 items-center text-sm" href="/">
              TravelOS
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="travel-chip inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-semibold" href="/timeline">
                {ui.timeline}
              </Link>
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_20rem] lg:items-end">
            <div className="min-w-0">
              <p className="travel-kicker text-sm">Journey library</p>
              <h1 className="travel-hand mt-2 text-4xl font-semibold tracking-normal sm:text-6xl">{ui.allJourneys}</h1>
              <p className="travel-muted mt-4 max-w-2xl text-sm leading-7 sm:text-base">{ui.intro}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="travel-soft-panel rounded-3xl px-5 py-4">
                <p className="travel-muted text-xs">Total</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--pine)]">{visibleTrips.length}</p>
              </div>
              <div className="travel-soft-panel rounded-3xl px-5 py-4">
                <p className="travel-muted text-xs">Public</p>
                <p className="mt-2 text-3xl font-semibold text-[color:var(--pine)]">{publicTrips.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
        <div className="grid gap-6">
          {visibleTrips.length > 0 ? (
            visibleTrips.map((trip) => <TripCard key={trip.id} trip={trip} />)
          ) : (
            <div className="travel-panel rounded-3xl p-8 text-center">
              <h2 className="travel-hand text-2xl font-semibold">目前沒有公開旅行</h2>
              <p className="travel-muted mt-3 text-sm">私人旅行仍保留在家庭編輯中，不會顯示在公開頁面。</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
