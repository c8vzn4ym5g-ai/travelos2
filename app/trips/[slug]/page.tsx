import Link from "next/link";
import { notFound } from "next/navigation";
import { getTripDetailBySlug, getTripDetailsByStartDate } from "@/lib/trips";
import type { Cost, Money, Photo, Place } from "@/lib/types";

interface TripDetailPageProps {
  params: Promise<{ slug: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

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

function formatCost(cost: Cost): string {
  return new Intl.NumberFormat("en", {
    currency: cost.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cost.amount);
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-teal-700">{kicker}</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-950">{title}</h2>
    </div>
  );
}

function PlaceRow({ place }: { place: Place }) {
  return (
    <article className="border-b border-zinc-100 py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-zinc-950">{place.name}</p>
          <p className="mt-1 text-sm text-zinc-500">
            {place.type} / {place.city}, {place.country}
          </p>
        </div>
        <span className="text-sm font-medium text-zinc-700">{place.rating ? `${place.rating}/5` : "Unrated"}</span>
      </div>
      {place.notes ? <p className="mt-2 text-sm leading-6 text-zinc-600">{place.notes}</p> : null}
    </article>
  );
}

function CostRow({ cost }: { cost: Cost }) {
  return (
    <article className="grid gap-2 border-b border-zinc-100 py-4 text-sm first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-medium capitalize text-zinc-950">{cost.category}</p>
        <p className="mt-1 text-zinc-500">
          {formatDate(cost.paidAt)}
          {cost.merchant ? ` / ${cost.merchant}` : ""}
        </p>
        {cost.notes ? <p className="mt-2 leading-6 text-zinc-600">{cost.notes}</p> : null}
      </div>
      <p className="font-semibold text-zinc-950">{formatCost(cost)}</p>
    </article>
  );
}

function PhotoTile({ photo }: { photo: Photo }) {
  return (
    <article className="min-h-44 rounded-lg border border-dashed border-zinc-300 bg-stone-100 p-4">
      <div className="flex h-full flex-col justify-between gap-8">
        <p className="text-xs font-semibold uppercase text-zinc-500">Album placeholder</p>
        <div>
          <p className="font-medium text-zinc-950">{photo.caption ?? photo.originalFilename}</p>
          <p className="mt-2 text-sm text-zinc-500">{photo.takenAt ? formatDate(photo.takenAt) : "Date not set"}</p>
        </div>
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return getTripDetailsByStartDate().map((trip) => ({ slug: trip.slug }));
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { slug } = await params;
  const trip = getTripDetailBySlug(slug);

  if (!trip) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/trips">
              Trips
            </Link>
            <span className="rounded-md bg-zinc-950 px-3 py-1 text-sm font-medium text-white">{trip.visibility}</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">
                {trip.country} / {trip.city}
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">{trip.title}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">{trip.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Dates</p>
                <p className="mt-2 font-semibold text-zinc-950">{formatDateRange(trip.startDate, trip.endDate)}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Total</p>
                <p className="mt-2 font-semibold text-zinc-950">{formatMoney(trip.totalCost)}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Rating</p>
                <p className="mt-2 font-semibold text-zinc-950">{trip.rating ? `${trip.rating}/5` : "Unrated"}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Photos</p>
                <p className="mt-2 font-semibold text-zinc-950">{trip.photos.length}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Overview" title="Trip memory" />
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-zinc-500">Base city</dt>
                <dd className="mt-1 font-medium">{trip.city}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Coordinates</dt>
                <dd className="mt-1 font-medium">
                  {trip.coordinates ? `${trip.coordinates.latitude}, ${trip.coordinates.longitude}` : "Not mapped"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Journal entries</dt>
                <dd className="mt-1 font-medium">{trip.journalEntries.length}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Saved places</dt>
                <dd className="mt-1 font-medium">{trip.places.length}</dd>
              </div>
            </dl>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Journal" title="Narrative notes" />
            <div className="mt-6 space-y-5">
              {trip.journalEntries.map((entry) => (
                <article className="border-b border-zinc-100 pb-5 last:border-0 last:pb-0" key={entry.id}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-semibold text-zinc-950">{entry.title}</h3>
                    <p className="text-sm text-zinc-500">{formatDate(entry.entryDate)}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{entry.body}</p>
                  <p className="mt-3 text-xs font-medium uppercase text-zinc-500">
                    {entry.mood ?? "Mood not set"} / {entry.weatherSummary ?? "Weather not set"}
                  </p>
                </article>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Album" title="Photo placeholders" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {trip.photos.map((photo) => (
                <PhotoTile key={photo.id} photo={photo} />
              ))}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Places" title="Saved stops" />
            <div className="mt-6">
              {trip.places.map((place) => (
                <PlaceRow key={place.id} place={place} />
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Costs" title="Tracked spend" />
            <div className="mt-6">
              {trip.costs.map((cost) => (
                <CostRow key={cost.id} cost={cost} />
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
