import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoffeeShopBySlug, getCoffeeShopDetailsByVisitDate } from "@/lib/coffee";

interface CoffeeDetailPageProps {
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

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-teal-700">{kicker}</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-950">{title}</h2>
    </div>
  );
}

export function generateStaticParams() {
  return getCoffeeShopDetailsByVisitDate().map((shop) => ({ slug: shop.slug }));
}

export default async function CoffeeDetailPage({ params }: CoffeeDetailPageProps) {
  const { slug } = await params;
  const shop = getCoffeeShopBySlug(slug);

  if (!shop) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/coffee">
              Coffee Map
            </Link>
            <span className="rounded-md bg-zinc-950 px-3 py-1 text-sm font-medium text-white">{shop.mood}</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">
                {shop.country} / {shop.city}
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">{shop.name}</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">{shop.comments}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Visited</p>
                <p className="mt-2 font-semibold text-zinc-950">{formatDate(shop.visitedAt)}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Rating</p>
                <p className="mt-2 font-semibold text-zinc-950">{shop.rating ? `${shop.rating}/5` : "Unrated"}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Photos</p>
                <p className="mt-2 font-semibold text-zinc-950">{shop.photos.length}</p>
              </div>
              <div className="rounded-md border border-zinc-200 bg-stone-50 px-4 py-3">
                <p className="text-xs text-zinc-500">Trip link</p>
                <p className="mt-2 font-semibold text-zinc-950">{shop.linkedTripId ? "Linked" : "Separate"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Coffee" title="Taste and place" />
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm text-zinc-500">Order</dt>
                <dd className="mt-1 font-medium">{shop.coffeeOrdered}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Address</dt>
                <dd className="mt-1 font-medium">{shop.address}</dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Coordinates</dt>
                <dd className="mt-1 font-medium">
                  {shop.coordinates ? `${shop.coordinates.latitude}, ${shop.coordinates.longitude}` : "Not mapped"}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-zinc-500">Links</dt>
                <dd className="mt-1 font-medium">
                  {shop.mapUrl ? (
                    <a className="text-teal-700" href={shop.mapUrl}>
                      Map link
                    </a>
                  ) : (
                    "No map link"
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Life note" title="What happened here" />
            <p className="mt-6 text-sm leading-7 text-zinc-700">{shop.lifeNote}</p>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Album" title="Photo placeholders" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {shop.photos.length > 0 ? (
                shop.photos.map((photo) => (
                  <article className="min-h-44 rounded-lg border border-dashed border-zinc-300 bg-stone-100 p-4" key={photo.id}>
                    <div className="flex h-full flex-col justify-between gap-8">
                      <p className="text-xs font-semibold uppercase text-zinc-500">Coffee photo</p>
                      <div>
                        <p className="font-medium text-zinc-950">{photo.caption ?? photo.originalFilename}</p>
                        <p className="mt-2 text-sm text-zinc-500">{photo.takenAt ? formatDate(photo.takenAt) : "Date not set"}</p>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-zinc-300 bg-stone-100 p-4 text-sm text-zinc-600">
                  No photos yet. This shop is ready for cup, storefront, menu, or table images later.
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Tags" title="How to find it later" />
            <div className="mt-6 flex flex-wrap gap-2">
              {shop.tags.map((tag) => (
                <span className="rounded-md bg-stone-100 px-3 py-2 text-sm font-medium text-zinc-700" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <SectionHeader kicker="Quick actions" title="Useful links" />
            <div className="mt-6 grid gap-3">
              {shop.mapUrl ? (
                <a className="rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white" href={shop.mapUrl}>
                  Open map link
                </a>
              ) : null}
              <Link className="rounded-md border border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-950" href="/coffee/new">
                Add another shop
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-950" href="/coffee">
                Return to coffee map
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
