import Link from "next/link";
import { getTripsByStartDate } from "@/lib/trips";
import type { Money, TripListItem } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDateRange(startDate: string, endDate: string): string {
  return `${dateFormatter.format(new Date(startDate))} - ${dateFormatter.format(new Date(endDate))}`;
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

function TripCard({ trip }: { trip: TripListItem }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">
            {trip.country} / {trip.city}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
            <Link href={`/trips/${trip.slug}`}>{trip.title}</Link>
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{trip.summary}</p>
        </div>
        <div className="grid min-w-36 grid-cols-2 gap-2 text-sm sm:grid-cols-1">
          <div className="rounded-md bg-stone-100 px-3 py-2">
            <p className="text-xs text-zinc-500">Rating</p>
            <p className="mt-1 font-semibold text-zinc-950">{trip.rating ? `${trip.rating}/5` : "Unrated"}</p>
          </div>
          <div className="rounded-md bg-stone-100 px-3 py-2">
            <p className="text-xs text-zinc-500">Cost</p>
            <p className="mt-1 font-semibold text-zinc-950">{formatMoney(trip.totalCost)}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
        <Link className="font-medium text-zinc-950" href={`/trips/${trip.slug}`}>
          Open details
        </Link>
      </div>
    </article>
  );
}

export default function TripsPage() {
  const trips = getTripsByStartDate();

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <Link className="text-sm font-medium text-teal-700" href="/">
            TravelOS
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Trip index</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">All journeys</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Browse recorded trips by date, country, city, and summary before the detail screens arrive.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link className="rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white" href="/trips/new">
                New draft
              </Link>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                  <p className="text-2xl font-semibold">{trips.length}</p>
                  <p className="text-xs text-zinc-500">Trips</p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                  <p className="text-2xl font-semibold">{new Set(trips.map((trip) => trip.country)).size}</p>
                  <p className="text-xs text-zinc-500">Countries</p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                  <p className="text-2xl font-semibold">{new Set(trips.map((trip) => trip.city)).size}</p>
                  <p className="text-xs text-zinc-500">Cities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="space-y-4">
          {trips.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      </section>
    </main>
  );
}
