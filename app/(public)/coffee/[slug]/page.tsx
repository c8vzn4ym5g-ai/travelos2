import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareActions } from "@/components/share-actions";
import { getCoffeeShopBySlug, getCoffeeShopDetailsByVisitDate } from "@/lib/coffee";
import { readCoffeeContent } from "@/lib/coffee-store";
import type { CoffeePhoto } from "@/lib/types";

export const dynamic = "force-dynamic";

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
      <p className="travel-kicker text-xs">{kicker}</p>
      <h2 className="travel-hand mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">{title}</h2>
    </div>
  );
}

function getCoverPhoto(photos: CoffeePhoto[]) {
  return photos.find(isRenderablePhoto) ?? null;
}

export async function generateStaticParams() {
  const { content } = await readCoffeeContent();
  return getCoffeeShopDetailsByVisitDate(content.shops).map((shop) => ({ slug: shop.slug }));
}

export async function generateMetadata({ params }: CoffeeDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { content } = await readCoffeeContent();
  const shop = getCoffeeShopBySlug(slug, content.shops);

  if (!shop) {
    return {};
  }

  const coverPhoto = getCoverPhoto(shop.photos);
  const title = `${shop.name} - Coffee note in ${shop.city}`;
  const description = (shop.lifeNote || shop.comments || `${shop.name} coffee note in ${shop.city}, ${shop.country}`).slice(0, 155);

  return {
    description,
    openGraph: {
      description,
      images: coverPhoto ? [{ alt: coverPhoto.caption ?? shop.name, url: coverPhoto.storageKey }] : [],
      title,
      type: "article",
      url: `/coffee/${shop.slug}`,
    },
    title,
  };
}

export default async function CoffeeDetailPage({ params }: CoffeeDetailPageProps) {
  const { slug } = await params;
  const { content } = await readCoffeeContent();
  const shop = getCoffeeShopBySlug(slug, content.shops);

  if (!shop) {
    notFound();
  }

  const coverPhoto = getCoverPhoto(shop.photos);
  const description = shop.lifeNote || shop.comments || `${shop.name} coffee note in ${shop.city}, ${shop.country}`;
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "CafeOrCoffeeShop",
    address: shop.address,
    image: coverPhoto ? [coverPhoto.storageKey] : undefined,
    name: shop.name,
    sameAs: [shop.websiteUrl, shop.mapUrl].filter(Boolean),
    url: `https://travelos2-63r3.vercel.app/coffee/${shop.slug}`,
  };

  return (
    <main className="travel-shell">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }} type="application/ld+json" />
      <section className="travel-hero">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="travel-kicker text-sm" href="/coffee">
              Coffee Map
            </Link>
            <span className="travel-chip rounded-full px-4 py-2 text-sm font-semibold">{shop.mood}</span>
          </div>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] lg:items-start">
            <div className="min-w-0">
              <p className="travel-kicker text-sm">
                {shop.country} / {shop.city}
              </p>
              <h1 className="travel-hand mt-3 text-4xl font-semibold leading-tight sm:text-6xl">{shop.name}</h1>
              <p className="travel-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">{description}</p>
              <div className="mt-6">
                <ShareActions description={description} path={`/coffee/${shop.slug}`} title={shop.name} />
              </div>
            </div>
            <div className="grid gap-3">
              {coverPhoto ? (
                <div className="travel-photo overflow-hidden rounded-[1.75rem] bg-[color:var(--paper-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={coverPhoto.caption ?? shop.name} className="aspect-[4/3] w-full object-cover" src={coverPhoto.storageKey} />
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  ["Visited", formatDate(shop.visitedAt)],
                  ["Rating", shop.rating ? `${shop.rating}/5` : "Unrated"],
                  ["Photos", String(shop.photos.length)],
                  ["Coffee", shop.coffeeOrdered],
                ].map(([label, value]) => (
                  <div className="travel-soft-panel rounded-2xl px-4 py-3" key={label}>
                    <p className="travel-muted text-xs">{label}</p>
                    <p className="mt-2 font-semibold text-[color:var(--pine)]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="space-y-6">
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Coffee" title="Taste and place" />
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="travel-muted text-sm">Order</dt>
                <dd className="mt-1 font-medium">{shop.coffeeOrdered}</dd>
              </div>
              <div>
                <dt className="travel-muted text-sm">Address</dt>
                <dd className="mt-1 font-medium">{shop.address}</dd>
              </div>
              <div>
                <dt className="travel-muted text-sm">Coordinates</dt>
                <dd className="mt-1 font-medium">
                  {shop.coordinates ? `${shop.coordinates.latitude}, ${shop.coordinates.longitude}` : "Not mapped"}
                </dd>
              </div>
              <div>
                <dt className="travel-muted text-sm">Links</dt>
                <dd className="mt-1 font-medium">
                  {shop.mapUrl ? (
                    <a className="text-[color:var(--teal)]" href={shop.mapUrl}>
                      Map link
                    </a>
                  ) : (
                    "No map link"
                  )}
                </dd>
              </div>
            </dl>
          </section>
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Reader guide" title="Good to know before going" />
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Mood", shop.mood],
                ["Photos", `${shop.photos.length} saved`],
                ["Visit", formatDate(shop.visitedAt)],
              ].map(([label, value]) => (
                <div className="travel-soft-panel rounded-2xl p-4" key={label}>
                  <p className="travel-kicker text-xs">{label}</p>
                  <p className="travel-muted mt-3 text-sm leading-6">{value}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Life note" title="What happened here" />
            <p className="travel-muted mt-6 text-base leading-8">{shop.lifeNote}</p>
          </section>
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Album" title="Coffee photos" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {shop.photos.length > 0 ? (
                shop.photos.map((photo) => <CoffeePhotoCard key={photo.id} photo={photo} />)
              ) : (
                <div className="travel-soft-panel rounded-2xl border-dashed p-4 text-sm text-[color:var(--muted)]">
                  No photos yet. This shop is ready for cup, storefront, menu, or table images later.
                </div>
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-6">
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Tags" title="How to find it later" />
            <div className="mt-6 flex flex-wrap gap-2">
              {shop.tags.map((tag) => (
                <span className="travel-chip rounded-full px-3 py-2 text-sm font-medium" key={tag}>
                  {tag}
                </span>
              ))}
            </div>
          </section>
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Quick actions" title="Useful links" />
            <div className="mt-6 grid gap-3">
              {shop.mapUrl ? (
                <a className="travel-primary rounded-full px-4 py-3 text-center text-sm font-semibold" href={shop.mapUrl}>
                  Open map link
                </a>
              ) : null}
              <Link className="travel-chip rounded-full px-4 py-3 text-center text-sm font-semibold" href="/coffee">
                Return to coffee map
              </Link>
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function isRenderablePhoto(photo: CoffeePhoto) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function CoffeePhotoCard({ photo }: { photo: CoffeePhoto }) {
  return (
    <article className="travel-soft-panel overflow-hidden rounded-3xl">
      {isRenderablePhoto(photo) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={photo.caption ?? photo.originalFilename} className="h-56 w-full object-cover" src={photo.storageKey} />
      ) : (
        <div className="grid h-56 place-items-center border-b border-dashed border-[color:var(--line)] text-sm text-[color:var(--muted)]">
          Photo pending upload
        </div>
      )}
      <div className="p-4">
        <p className="font-medium text-[color:var(--ink)]">{photo.caption ?? photo.originalFilename}</p>
        <p className="travel-muted mt-2 text-sm">{photo.takenAt ? formatDate(photo.takenAt) : "Date not set"}</p>
      </div>
    </article>
  );
}
