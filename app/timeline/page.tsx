import Link from "next/link";
import { getTripDetailsByStartDate } from "@/lib/trips";
import type { TripDetail } from "@/lib/types";

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

function getMonthKey(date: string) {
  return date.slice(0, 7);
}

function formatRange(trip: TripDetail) {
  return `${dateFormatter.format(new Date(trip.startDate))} - ${dateFormatter.format(new Date(trip.endDate))}`;
}

function groupTripsByMonth(trips: TripDetail[]) {
  return trips.reduce<Array<{ key: string; label: string; trips: TripDetail[] }>>((groups, trip) => {
    const key = getMonthKey(trip.startDate);
    const existingGroup = groups.find((group) => group.key === key);

    if (existingGroup) {
      existingGroup.trips.push(trip);
      return groups;
    }

    groups.push({
      key,
      label: monthFormatter.format(new Date(`${key}-01T00:00:00.000Z`)),
      trips: [trip],
    });
    return groups;
  }, []);
}

export default function TimelinePage() {
  const trips = getTripDetailsByStartDate();
  const groupedTrips = groupTripsByMonth(trips);

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <div className="flex gap-3 text-sm">
              <Link className="font-medium text-zinc-700" href="/trips">
                Trips
              </Link>
              <Link className="font-medium text-zinc-700" href="/map">
                Map
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Travel timeline</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Journeys by month</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                A chronological view for browsing long-term travel memory before deeper filtering and analytics arrive.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4 text-sm">
              <p className="text-zinc-500">Timeline groups</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-950">{groupedTrips.length}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
        <div className="space-y-8">
          {groupedTrips.map((group) => (
            <section className="grid gap-4 md:grid-cols-[12rem_1fr]" key={group.key}>
              <div>
                <p className="sticky top-6 text-sm font-semibold uppercase text-teal-700">{group.label}</p>
              </div>
              <div className="space-y-4 border-l border-zinc-200 pl-5">
                {group.trips.map((trip) => (
                  <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" key={trip.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-zinc-500">
                          {formatRange(trip)} / {trip.city}, {trip.country}
                        </p>
                        <h2 className="mt-2 text-2xl font-semibold">
                          <Link href={`/trips/${trip.slug}`}>{trip.title}</Link>
                        </h2>
                      </div>
                      <span className="rounded-md bg-stone-100 px-3 py-1 text-sm font-medium text-zinc-700">
                        {trip.rating ? `${trip.rating}/5` : "Unrated"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-600">{trip.summary}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
