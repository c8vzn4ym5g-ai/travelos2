import Link from "next/link";
import { getTripDetailsByStartDate } from "@/lib/trips";

function getPinPosition(latitude: number, longitude: number) {
  return {
    left: `${((longitude + 180) / 360) * 100}%`,
    top: `${((90 - latitude) / 180) * 100}%`,
  };
}

export default function MapPage() {
  const trips = getTripDetailsByStartDate().filter((trip) => trip.coordinates);

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
              <Link className="font-medium text-zinc-700" href="/trips/new">
                New draft
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Map workspace</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">World memory map</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                A provider-neutral map placeholder that uses saved trip coordinates now and can be replaced by a real map provider later.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4 text-sm">
              <p className="text-zinc-500">Mapped trips</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-950">{trips.length}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1fr_20rem] lg:px-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="relative min-h-[420px] overflow-hidden rounded-md border border-zinc-200 bg-stone-100">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(113,113,122,0.15)_1px,transparent_1px),linear-gradient(to_bottom,rgba(113,113,122,0.15)_1px,transparent_1px)] bg-[size:12.5%_16.66%]" />
            <div className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-2 text-xs font-medium uppercase text-zinc-500 shadow-sm">
              Placeholder projection
            </div>
            {trips.map((trip) => {
              const coordinates = trip.coordinates;
              if (!coordinates) {
                return null;
              }

              return (
                <Link
                  aria-label={`Open ${trip.title}`}
                  className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal-700 shadow-md outline-none transition hover:scale-125 focus:scale-125"
                  href={`/trips/${trip.slug}`}
                  key={trip.id}
                  style={getPinPosition(coordinates.latitude, coordinates.longitude)}
                />
              );
            })}
          </div>
        </div>
        <aside className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-teal-700">Trip pins</p>
          <h2 className="mt-2 text-2xl font-semibold">Mapped journeys</h2>
          <div className="mt-6 space-y-4">
            {trips.map((trip) => (
              <article className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0" key={trip.id}>
                <Link className="font-medium text-zinc-950" href={`/trips/${trip.slug}`}>
                  {trip.title}
                </Link>
                <p className="mt-1 text-sm text-zinc-500">
                  {trip.city}, {trip.country}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  {trip.coordinates
                    ? `${trip.coordinates.latitude.toFixed(4)}, ${trip.coordinates.longitude.toFixed(4)}`
                    : "Coordinates not set"}
                </p>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
