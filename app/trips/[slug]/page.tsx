import Link from "next/link";
import { notFound } from "next/navigation";
import { JourneyMusicPlayer } from "@/components/journey-music-player";
import { readContent } from "@/lib/editable-store";
import { getTripDetailsByStartDate } from "@/lib/trips";
import type { Cost, Money, Photo, Place } from "@/lib/types";

export const dynamic = "force-dynamic";

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

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
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

function PlaceRow({ place }: { place: Place }) {
  return (
    <article className="border-b border-[color:var(--line)] py-4 first:pt-0 last:border-0 last:pb-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[color:var(--ink)]">{place.name}</p>
          <p className="travel-muted mt-1 text-sm">
            {place.type} / {place.city}, {place.country}
          </p>
        </div>
        <span className="text-sm font-semibold text-[color:var(--pine)]">{place.rating ? `${place.rating}/5` : "Unrated"}</span>
      </div>
      {place.notes ? <p className="travel-muted mt-2 text-sm leading-6">{place.notes}</p> : null}
    </article>
  );
}

function CostRow({ cost }: { cost: Cost }) {
  return (
    <article className="grid gap-2 border-b border-[color:var(--line)] py-4 text-sm first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-semibold capitalize text-[color:var(--ink)]">{cost.category}</p>
        <p className="travel-muted mt-1">
          {formatDate(cost.paidAt)}
          {cost.merchant ? ` / ${cost.merchant}` : ""}
        </p>
        {cost.notes ? <p className="travel-muted mt-2 leading-6">{cost.notes}</p> : null}
      </div>
      <p className="font-semibold text-[color:var(--pine)]">{formatCost(cost)}</p>
    </article>
  );
}

function PhotoTile({ photo }: { photo: Photo }) {
  const canRenderPhoto = isRenderablePhoto(photo);

  return (
    <article className="travel-soft-panel overflow-hidden rounded-[1.5rem]" data-music-zone={`${photo.caption ?? ""} ${photo.originalFilename}`}>
      {canRenderPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt={photo.caption ?? photo.originalFilename} className="h-56 w-full object-cover" src={photo.storageKey} />
      ) : (
        <div className="grid h-56 place-items-center bg-[color:var(--paper-soft)] p-4 text-center text-sm font-medium text-[color:var(--muted)]">
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

export function generateStaticParams() {
  return getTripDetailsByStartDate().map((trip) => ({ slug: trip.slug }));
}

export default async function TripDetailPage({ params }: TripDetailPageProps) {
  const { slug } = await params;
  const { content } = await readContent();
  const trip = content.trips.find((item) => item.slug === slug);

  if (!trip) {
    notFound();
  }

  const coverPhoto =
    trip.photos.find((photo) => photo.id === trip.coverPhotoId && isRenderablePhoto(photo)) ??
    trip.photos.find(isRenderablePhoto);
  const featurePhotos = trip.photos.filter(isRenderablePhoto).slice(0, 4);

  return (
    <main className="travel-shell">
      <JourneyMusicPlayer tracks={trip.musicTracks ?? []} />
      <section className="travel-hero" data-music-zone={`${trip.title} ${trip.summary} ${trip.city} ${trip.country}`}>
        <div className="mx-auto flex max-w-6xl flex-col gap-7 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="travel-kicker text-sm" href="/trips">
              Trips
            </Link>
            <span className="travel-chip rounded-full px-4 py-2 text-sm font-semibold">{trip.visibility}</span>
          </div>
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,26rem)] lg:items-start">
            <div className="min-w-0">
              <p className="travel-kicker text-sm">
                {trip.country} / {trip.city}
              </p>
              <h1 className="travel-hand mt-3 text-4xl font-semibold leading-tight sm:text-6xl">{trip.title}</h1>
              <p className="travel-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">{trip.summary}</p>
              <div className="mt-6 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
                {[
                  ["Dates", formatDateRange(trip.startDate, trip.endDate)],
                  ["Total", formatMoney(trip.totalCost)],
                  ["Rating", trip.rating ? `${trip.rating}/5` : "Unrated"],
                  ["Photos", String(trip.photos.length)],
                ].map(([label, value], index) => (
                  <div className={`travel-soft-panel rounded-2xl px-4 py-3 ${index === 0 ? "travel-accent" : ""}`} key={label}>
                    <p className="travel-muted text-xs">{label}</p>
                    <p className="mt-2 font-semibold text-[color:var(--pine)]">{value}</p>
                  </div>
                ))}
              </div>
            </div>
            {coverPhoto ? (
              <div className="travel-photo overflow-hidden rounded-[1.75rem] bg-[color:var(--paper-soft)] lg:max-w-[26rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={coverPhoto.caption ?? trip.title} className="aspect-[4/3] w-full object-cover" src={coverPhoto.storageKey} />
              </div>
            ) : null}
          </div>
          {featurePhotos.length > 1 ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {featurePhotos.map((photo) => (
                <article className="travel-soft-panel overflow-hidden rounded-2xl" data-music-zone={`${photo.caption ?? ""} ${photo.originalFilename}`} key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={photo.caption ?? photo.originalFilename} className="h-32 w-full object-cover sm:h-40" src={photo.storageKey} />
                  <p className="travel-muted p-3 text-xs leading-5 sm:text-sm">{photo.caption ?? photo.originalFilename}</p>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)] lg:px-10">
        <div className="space-y-6">
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Overview" title="Trip memory" />
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                ["Base city", trip.city],
                ["Coordinates", trip.coordinates ? `${trip.coordinates.latitude}, ${trip.coordinates.longitude}` : "Not mapped"],
                ["Journal entries", String(trip.journalEntries.length)],
                ["Saved places", String(trip.places.length)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="travel-muted text-sm">{label}</dt>
                  <dd className="mt-1 font-semibold text-[color:var(--ink)]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Journal" title="Narrative notes" />
            <div className="mt-7 space-y-6">
              {trip.journalEntries.map((entry) => (
                <article className="border-b border-[color:var(--line)] pb-6 last:border-0 last:pb-0" data-music-zone={`${entry.title} ${entry.body}`} key={entry.id}>
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-semibold text-[color:var(--ink)]">{entry.title}</h3>
                    <p className="travel-muted text-sm">{formatDate(entry.entryDate)}</p>
                  </div>
                  <NarrativeBody body={entry.body} />
                  <p className="travel-kicker mt-4 text-xs">
                    {entry.mood ?? "Mood not set"} / {entry.weatherSummary ?? "Weather not set"}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Album" title="Photo memories" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {trip.photos.map((photo) => (
                <PhotoTile key={photo.id} photo={photo} />
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
            <SectionHeader kicker="Places" title="Saved stops" />
            <div className="mt-6">
              {trip.places.map((place) => (
                <PlaceRow key={place.id} place={place} />
              ))}
            </div>
          </section>
          <section className="travel-panel rounded-3xl p-5 sm:p-7">
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
