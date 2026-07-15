import Link from "next/link";
import { getCoffeeShopsByVisitDate } from "@/lib/coffee";

export default function CoffeeMapPage() {
  const shops = getCoffeeShopsByVisitDate();

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <Link className="text-sm font-medium text-teal-700" href="/coffee">
            Coffee Map
          </Link>
          <div>
            <p className="text-sm font-medium uppercase text-zinc-500">Map view</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Coffee pins across countries</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              Provider-neutral map placeholder for now. The coffee data is kept separate from trip journals but can be
              linked to a trip when useful.
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.2fr_0.8fr] lg:px-10">
        <div className="grid min-h-[520px] place-items-center rounded-lg border border-dashed border-zinc-300 bg-white p-6">
          <div className="max-w-md text-center">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Map placeholder</p>
            <p className="mt-3 text-3xl font-semibold text-zinc-950">Coffee shops become pins here.</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Next step: connect a map provider and place pins from each shop&apos;s coordinates or pasted Google Maps link.
            </p>
          </div>
        </div>
        <aside className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-2xl font-semibold">Pinned cafes</h2>
          <div className="mt-5 space-y-4">
            {shops.map((shop) => (
              <article className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0" key={shop.id}>
                <p className="font-medium">{shop.name}</p>
                <p className="mt-1 text-sm text-zinc-500">
                  {shop.city}, {shop.country}
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{shop.address}</p>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
