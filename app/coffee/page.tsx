import Link from "next/link";
import { getCoffeeShopsByVisitDate, getCoffeeStats } from "@/lib/coffee";
import type { CoffeeShopListItem } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(date));
}

function CoffeeCard({ shop }: { shop: CoffeeShopListItem }) {
  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-medium text-teal-700">
            {shop.country} / {shop.city}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-zinc-950">
            <Link href={`/coffee/${shop.slug}`}>{shop.name}</Link>
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{shop.comments}</p>
          <p className="mt-3 text-sm leading-6 text-zinc-700">{shop.lifeNote}</p>
        </div>
        <div className="grid min-w-40 grid-cols-2 gap-2 text-sm sm:grid-cols-1">
          <div className="rounded-md bg-stone-100 px-3 py-2">
            <p className="text-xs text-zinc-500">Coffee</p>
            <p className="mt-1 font-semibold text-zinc-950">{shop.coffeeOrdered}</p>
          </div>
          <div className="rounded-md bg-stone-100 px-3 py-2">
            <p className="text-xs text-zinc-500">Rating</p>
            <p className="mt-1 font-semibold text-zinc-950">{shop.rating ? `${shop.rating}/5` : "Unrated"}</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-zinc-100 pt-4 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
        <span>
          {formatDate(shop.visitedAt)} / {shop.address}
        </span>
        <Link className="font-medium text-zinc-950" href={`/coffee/${shop.slug}`}>
          Open note
        </Link>
      </div>
    </article>
  );
}

export default function CoffeePage() {
  const shops = getCoffeeShopsByVisitDate();
  const stats = getCoffeeStats();

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <Link className="text-sm font-medium text-teal-700" href="/">
            TravelOS
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Coffee Map</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Coffee shops and life notes</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                A separate coffee workspace for addresses, map links, photos, comments, and memories that do not need to
                live inside a trip journal.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Link className="rounded-md border border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-950" href="/coffee/map">
                  Map view
                </Link>
                <Link className="rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white" href="/coffee/new">
                  Add coffee shop
                </Link>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                  <p className="text-2xl font-semibold">{stats.shops}</p>
                  <p className="text-xs text-zinc-500">Shops</p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                  <p className="text-2xl font-semibold">{stats.countries}</p>
                  <p className="text-xs text-zinc-500">Countries</p>
                </div>
                <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                  <p className="text-2xl font-semibold">{stats.cities}</p>
                  <p className="text-xs text-zinc-500">Cities</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="space-y-4">
          {shops.map((shop) => (
            <CoffeeCard key={shop.id} shop={shop} />
          ))}
        </div>
      </section>
    </main>
  );
}
