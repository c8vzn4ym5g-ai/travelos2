import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReaderAlbum, ReaderFilm, ReaderPhoto } from "@/components/reader-media";
import { getTripPromoVideos } from "@/lib/promo-videos";
import { isTripPhotoVideo } from "@/lib/trip-photo";
import { BookingBand } from "@/components/booking-band";
import { JournalCostChip, JournalSpendPanel } from "@/components/journal-spend";
import { JourneyMap } from "@/components/journey-map";
import { JourneyMusicPlayer } from "@/components/journey-music-player";
import { LaplandCutStill } from "@/components/lapland-cut-still";
import { LaplandMoreCut } from "@/components/lapland-more-cut";
import { LaplandPlaceKnowledge } from "@/components/lapland-place-knowledge";
import { LaplandPublicCut } from "@/components/lapland-public-cut";
import { LaplandStorefrontGate } from "@/components/lapland-storefront-gate";
import { LaplandStorefrontGlance } from "@/components/lapland-storefront-glance";
import { LaplandVisualPath } from "@/components/lapland-visual-path";
import { ShareActions } from "@/components/share-actions";
import { StorefrontHomeLink } from "@/components/storefront-home-link";
import { readContent } from "@/lib/editable-store";
import { publishedTrip } from "@/lib/trip-publication";
import { isLaplandPhoneUserAgent } from "@/lib/lapland-mobile";
import { publicSiteUrl } from "@/lib/site-url";
import {
  forLaplandPublicPage,
  isLaplandStayJournal,
  isLaplandStorefrontSlug,
  laplandPublicStops,
  storefrontMetaDescription,
  LAPLAND_PHOTO_CREDITS,
  LAPLAND_SEASON_LABEL,
  type LaplandPublicStop,
} from "@/lib/lapland-storefront-copy";
import { getLaplandBooking } from "@/lib/travelpayouts";
import { isTripPublic } from "@/lib/trip-visibility";
import { getTripDetailsByStartDate } from "@/lib/trips";
import type { Money, Photo, Place } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TripDetailPageProps {
  params: Promise<{ slug: string }>;
}

const loadTripCatalog = cache(async () => {
    return (await readContent()).content.trips.flatMap(trip => { const visible = publishedTrip(trip); return visible ? [visible] : []; });
});

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(date: string | null | undefined): string {
  if (!date) {
    return "Date not set";
  }

  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return "Date not set";
  }

  return dateFormatter.format(parsed);
}

function getSeasonLabel(date: string): string {
  const parsedDate = new Date(date);
  const year = Number.isNaN(parsedDate.getTime()) ? date.slice(0, 4) : String(parsedDate.getFullYear());
  const month = Number.isNaN(parsedDate.getTime()) ? Number(date.slice(5, 7)) : parsedDate.getMonth() + 1;
  const season =
    month === 12 || month <= 2
      ? "Winter"
      : month <= 5
        ? "Spring"
        : month <= 8
          ? "Summer"
          : "Autumn";

  return `${season} ${year}`;
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

function clampWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length <= maxWords ? text : `${words.slice(0, maxWords).join(" ")}…`;
}

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div>
      <p className="travel-kicker text-xs">{kicker}</p>
      <h2 className="travel-hand mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">{title}</h2>
    </div>
  );
}

function NarrativeBody({ body }: { body: string }) {
  return (
    <div className="mt-4 space-y-4">
      {body.split("\n\n").map((paragraph) => (
        <p className="travel-muted text-base leading-8" key={paragraph}>
          {paragraph}
        </p>
      ))}
    </div>
  );
}

function toStopRow(place: Place): LaplandPublicStop {
  return {
    detail: `${place.type} / ${place.city}, ${place.country}`,
    id: place.id,
    name: place.name,
    notes: place.notes,
    rating: place.rating,
  };
}

function PlaceRow({ place }: { place: LaplandPublicStop }) {
  return (
    <article className="border-b border-[color:var(--line)] py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[color:var(--ink)]">{place.name}</p>
          <p className="travel-muted mt-1 text-sm">{place.detail}</p>
        </div>
        {place.rating ? <span className="text-sm font-semibold text-[color:var(--pine)]">{place.rating}/5</span> : null}
      </div>
      {place.notes ? <p className="travel-muted mt-2 text-sm leading-6">{place.notes}</p> : null}
    </article>
  );
}

function MemoryChip({ label, tone, value }: { label: string; tone: string; value: string }) {
  return (
    <div className={`rounded-full border px-3 py-2 text-sm shadow-sm ${tone}`}>
      <span className="travel-kicker mr-2 text-[0.65rem]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function generateStaticParams() {
  return getTripDetailsByStartDate().map((trip) => ({ slug: trip.slug }));
}

export async function generateMetadata({ params }: TripDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const trips = await loadTripCatalog();
  const trip = trips.find((item) => item.slug === slug);

  if (!trip || !isTripPublic(trip)) {
    return {};
  }

  const coverPhoto =
    trip.photos.find((photo) => photo.id === trip.coverPhotoId && isRenderablePhoto(photo) && !isTripPhotoVideo(photo)) ??
    trip.photos.find((photo) => isRenderablePhoto(photo) && !isTripPhotoVideo(photo));
  const title = `${trip.title} - ${trip.city}, ${trip.country}`;
  const description = storefrontMetaDescription(trip.summary, trip.slug);

  return {
    alternates: {
      canonical: `/trips/${trip.slug}`,
    },
    description,
    openGraph: {
      description,
      images: coverPhoto ? [{ alt: coverPhoto.caption ?? trip.title, url: coverPhoto.storageKey }] : [],
      title,
      type: "article",
      url: `/trips/${trip.slug}`,
    },
    title,
    twitter: {
      description,
    },
  };
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { slug } = await params;
  const trips = await loadTripCatalog();
  const found = trips.find((item) => item.slug === slug);

  if (!found || !isTripPublic(found)) {
    notFound();
  }

  const trip = isLaplandStorefrontSlug(found.slug) ? forLaplandPublicPage(found) : found;

  const coverPhoto =
    trip.photos.find((photo) => photo.id === trip.coverPhotoId && isRenderablePhoto(photo) && !isTripPhotoVideo(photo)) ??
    trip.photos.find((photo) => isRenderablePhoto(photo) && !isTripPhotoVideo(photo));
  const renderablePhotos = trip.photos.filter(isRenderablePhoto);
  const isLapland = isLaplandStorefrontSlug(trip.slug);
  const seasonLabel = isLapland ? LAPLAND_SEASON_LABEL : getSeasonLabel(trip.startDate);
  const heroSummary = clampWords(trip.summary, 88);
  const storyMoments = trip.journalEntries.map((entry, index) => ({
    entry, index,
    photo: entry.storyPhotoId ? renderablePhotos.find(photo => photo.id === entry.storyPhotoId) : undefined,
  }));
  const pageMoments = isLapland ? storyMoments.filter(({ entry }) => !isLaplandStayJournal(entry)) : storyMoments;
  const savedStops = isLapland ? laplandPublicStops(trip.places) : trip.places.map(toStopRow);
  const uaPhone = isLapland ? isLaplandPhoneUserAgent((await headers()).get("user-agent") ?? "") : false;
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelBlogPosting",
    description: trip.summary,
    headline: trip.title,
    image: coverPhoto ? [coverPhoto.storageKey] : undefined,
    locationCreated: {
      "@type": "Place",
      address: `${trip.city}, ${trip.country}`,
      name: `${trip.city}, ${trip.country}`,
    },
    mainEntityOfPage: publicSiteUrl(`/trips/${trip.slug}`),
    ...(isLapland
      ? {}
      : {
          dateModified: trip.updatedAt,
          datePublished: trip.createdAt,
        }),
  };

  return (
    <LaplandStorefrontGate coverPhoto={coverPhoto} enabled={isLapland} trip={trip} uaPhone={uaPhone}>
    <main className="travel-shell">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} type="application/ld+json" />
      <JourneyMusicPlayer tracks={trip.musicTracks ?? []} />
      <section className="travel-hero" data-music-zone={`${trip.title} ${trip.summary} ${trip.city} ${trip.country}`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <StorefrontHomeLink />
              <Link className="travel-chip inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold" href="/trips">
                旅程
              </Link>
            </div>
            <span className="travel-chip rounded-full px-4 py-2 text-sm font-semibold">{trip.visibility}</span>
          </div>
          <div className="travel-soft-panel rounded-[1.5rem] p-4 sm:p-5">
            <p className="travel-kicker text-sm">
              {isLaplandStorefrontSlug(trip.slug) ? "Finland / Rovaniemi · Helsinki" : `${trip.country} / ${trip.city}`}
            </p>
            <h1 className="travel-hand mt-3 text-4xl font-semibold leading-tight sm:text-6xl">{trip.title}</h1>
            {isLapland ? null : (
              <>
                <p className="travel-muted mt-4 max-w-4xl text-base leading-8 sm:text-lg">{heroSummary}</p>
                <div className="mt-5">
                  <ShareActions description={trip.summary} path={`/trips/${trip.slug}`} title={trip.title} />
                </div>
              </>
            )}
          </div>
          {isLapland ? <LaplandPublicCut /> : <ReaderFilm videos={getTripPromoVideos(trip.slug)} poster={coverPhoto?.storageKey} />}
          {isLapland && coverPhoto ? <LaplandCutStill photo={coverPhoto} /> : null}
          {isLapland ? (
            <LaplandMoreCut>
              <div className="max-w-4xl">
                <p className="travel-muted text-base leading-8 sm:text-lg">{heroSummary}</p>
                <div className="mt-5">
                  <ShareActions description={trip.summary} path={`/trips/${trip.slug}`} title={trip.title} />
                </div>
              </div>
              <JourneyMap
                center={trip.coordinates}
                city={trip.city}
                country={trip.country}
                journalEntries={trip.journalEntries}
                photos={trip.photos}
                places={trip.places}
                route={trip.travelRoute ?? []}
                title={trip.title}
              />
              <LaplandStorefrontGlance />
              <LaplandVisualPath photos={trip.photos} />
              <LaplandPlaceKnowledge />
              <div className="flex flex-wrap items-center gap-2">
                {[
                  ["Season", seasonLabel, "border-sky-100 bg-sky-50 text-sky-950"],
                  ["Mood", trip.journalEntries[0]?.mood ?? "Memory", "border-rose-100 bg-rose-50 text-rose-950"],
                  ["Photos", `${trip.photos.length}`, "border-amber-100 bg-amber-50 text-amber-950"],
                ].map(([label, value, tone]) => (
                  <MemoryChip key={label} label={label} tone={tone} value={value} />
                ))}
                {trip.totalCost ? (
                  <JournalCostChip amount={formatMoney(trip.totalCost)} slug={trip.slug} />
                ) : (
                  <MemoryChip label="Cost" tone="border-teal-100 bg-teal-50 text-teal-950" value="Not tracked" />
                )}
              </div>
            </LaplandMoreCut>
          ) : (
            <JourneyMap
              center={trip.coordinates}
              city={trip.city}
              country={trip.country}
              journalEntries={trip.journalEntries}
              photos={trip.photos}
              places={trip.places}
              route={trip.travelRoute ?? []}
              title={trip.title}
            />
          )}
          {isLapland ? null : (
          <div className="flex flex-wrap items-center gap-2">
            {[
              ["Season", seasonLabel, "border-sky-100 bg-sky-50 text-sky-950"],
              ["Mood", trip.journalEntries[0]?.mood ?? "Memory", "border-rose-100 bg-rose-50 text-rose-950"],
              ["Photos", `${trip.photos.length}`, "border-amber-100 bg-amber-50 text-amber-950"],
            ].map(([label, value, tone]) => (
              <MemoryChip key={label} label={label} tone={tone} value={value} />
            ))}
            {trip.totalCost ? (
              <JournalCostChip amount={formatMoney(trip.totalCost)} slug={trip.slug} />
            ) : (
              <MemoryChip label="Cost" tone="border-teal-100 bg-teal-50 text-teal-950" value="Not tracked" />
            )}
          </div>
          )}
          {!isLapland && coverPhoto ? <figure className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl"><ReaderPhoto photo={coverPhoto} priority /></figure> : null}

        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:px-10">
        <div className="space-y-5">
          <section className="travel-panel rounded-2xl p-4 sm:p-5">
            <SectionHeader kicker="Overview" title="Trip memory" />
            <dl className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ["Base city", trip.city],
                ["Coordinates", trip.coordinates ? `${trip.coordinates.latitude}, ${trip.coordinates.longitude}` : "Not mapped"],
                ["Journal entries", String(trip.journalEntries.length)],
                ["Saved places", String(savedStops.length)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="travel-kicker text-[0.65rem]">{label}</dt>
                  <dd className="mt-1 line-clamp-1 text-sm font-semibold text-[color:var(--ink)]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="space-y-8" aria-label="旅程故事">
            <SectionHeader kicker="Journal" title="旅途裡的故事" />
            <nav aria-label="故事章節" className="flex flex-wrap gap-2">
              {pageMoments.map(({entry}, index) => <a className="travel-chip min-h-11 rounded-full px-4 py-3 text-sm" href={`#story-${entry.id}`} key={entry.id}>{index + 1} · {entry.title}</a>)}
            </nav>
            {storyMoments.map(({entry, photo}, index) => (
              <article className="scroll-mt-6 overflow-hidden rounded-3xl bg-white/70" data-music-zone={`${entry.title} ${entry.body}`} id={`story-${entry.id}`} key={entry.id}>
                {photo ? <figure><ReaderPhoto photo={photo} />{photo.caption ? <figcaption className="px-5 pt-3 text-sm leading-6 text-[color:var(--muted)]">{photo.caption}</figcaption> : null}</figure> : null}
                <div className="p-5 sm:p-8">
                  <p className="travel-kicker text-xs">{String(index + 1).padStart(2, "0")} · {isLapland ? LAPLAND_SEASON_LABEL : formatDate(entry.entryDate)}</p>
                  <h3 className="travel-hand mt-3 text-2xl font-semibold leading-snug">{entry.title}</h3>
                  <NarrativeBody body={entry.body} />
                </div>
              </article>
            ))}
          </section>

          {isLaplandStorefrontSlug(trip.slug) ? <BookingBand destination={getLaplandBooking()} /> : null}

          <ReaderAlbum photos={renderablePhotos} />

          {isLaplandStorefrontSlug(trip.slug) ? (
            <footer className="travel-muted px-1 text-[0.7rem] leading-6" data-photo-credits="">
              <p className="travel-kicker text-[0.65rem]">圖片出處 / Photo credits</p>
              {LAPLAND_PHOTO_CREDITS.map((credit) => (
                <p key={credit.id}>
                  {credit.lineZh} {credit.line}
                </p>
              ))}
            </footer>
          ) : null}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-5">
          <section className="travel-panel rounded-2xl p-4">
            <SectionHeader kicker="Story contents" title="On this page" />
            <div className="mt-4 grid gap-2">
              {pageMoments.map(({ entry, photo }, index) => (
                <a href={`#story-${entry.id}`} className="grid grid-cols-[3.25rem_1fr] gap-3 rounded-2xl border border-[color:var(--line)] bg-white/60 p-2" key={entry.id}>
                  <div className="overflow-hidden rounded-xl bg-[color:var(--paper-soft)]">
                    {photo && isRenderablePhoto(photo) && !isTripPhotoVideo(photo) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={photo.caption ?? entry.title} className="h-14 w-full object-cover" loading="lazy" src={photo.storageKey} />
                    ) : (
                      <div className="grid h-14 place-items-center text-xs text-[color:var(--muted)]">{index + 1}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="travel-kicker text-[0.65rem]">Moment {index + 1}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--ink)]">{entry.title}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
          <section className="travel-panel rounded-2xl p-4">
            <SectionHeader kicker="Places" title="Saved stops" />
            <div className="mt-4">
              {savedStops.map((place) => (
                <PlaceRow key={place.id} place={place} />
              ))}
            </div>
          </section>
          <JournalSpendPanel costs={trip.costs ?? []} slug={trip.slug} startDate={trip.startDate} totalCost={trip.totalCost} />
        </aside>
      </section>
    </main>
    </LaplandStorefrontGate>
  );
}
