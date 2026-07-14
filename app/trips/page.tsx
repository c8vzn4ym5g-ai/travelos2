import Link from "next/link";
import { readContent } from "@/lib/editable-store";
import type { Money, Photo, TripDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  return (
    <article className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      {coverPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={coverPhoto.caption ?? trip.title} className="h-48 w-full object-cover sm:h-64" src={coverPhoto.storageKey} />
      ) : (
        <div className="grid h-40 place-items-center bg-stone-100 p-4 text-sm font-medium text-zinc-500 sm:h-56">
          Photo pending
        </div>
      )}

      <div className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-teal-700">
              {trip.country} / {trip.city}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-zinc-950 sm:text-2xl">
              <Link href={articleHref(trip)}>{trip.title}</Link>
            </h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">{trip.summary}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-36 sm:grid-cols-1">
            <div className="rounded-md bg-stone-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Rating</p>
              <p className="mt-1 font-semibold text-zinc-950">{trip.rating ? `${trip.rating}/5` : "Unrated"}</p>
            </div>
            <div className="rounded-md bg-stone-50 px-3 py-2">
              <p className="text-xs text-zinc-500">Cost</p>
              <p className="mt-1 font-semibold text-zinc-950">{formatMoney(trip.totalCost)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          <Link className="rounded-md bg-zinc-950 px-4 py-2 text-center font-medium text-white sm:bg-transparent sm:px-0 sm:py-0 sm:text-zinc-950" href={articleHref(trip)}>
            閱讀 / Open details
          </Link>
        </div>
      </div>
    </article>
  );
}

export default async function TripsPage() {
  const { content } = await readContent();
  const trips = [...content.trips].sort((first, second) => second.startDate.localeCompare(first.startDate));
  const publicTrips = trips.filter((trip) => trip.visibility !== "private");

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium" href="/timeline">
                時間線 / Timeline
              </Link>
              <Link className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-medium text-white" href="/trips/new">
                新旅程草稿 / New draft
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div className="min-w-0">
              <p className="text-sm font-medium uppercase text-zinc-500">Journey library</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-5xl">全部旅程 / All journeys</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-600">
                這裡是 TravelOS 的旅程入口。每一篇文章都用自己的網址開啟，之後新增旅程不需要再建立固定頁面。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Total</p>
                <p className="mt-2 text-2xl font-semibold">{trips.length}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Shared</p>
                <p className="mt-2 text-2xl font-semibold">{publicTrips.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        <div className="grid gap-5">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      </section>
    </main>
  );
}
