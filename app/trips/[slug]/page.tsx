import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JourneyMusicPlayer } from "@/components/journey-music-player";
import { ShareActions } from "@/components/share-actions";
import { readContent } from "@/lib/editable-store";
import { getTripDetailsByStartDate } from "@/lib/trips";
import type { Cost, JournalEntry, Money, Photo, Place } from "@/lib/types";

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

function getReadingMinutes(entries: JournalEntry[]) {
  const words = entries.reduce((total, entry) => total + entry.body.split(/\s+/).filter(Boolean).length, 0);
  return Math.max(1, Math.ceil(words / 180));
}

function getFirstSentence(text: string) {
  const sentence = text.split(/\n\n|\. |! |\? /)[0]?.trim();
  return sentence || text.slice(0, 140);
}

function clampWords(text: string, maxWords: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) {
    return text;
  }

  return `${words.slice(0, maxWords).join(" ")}...`;
}

function getStoryKeywords(entry: JournalEntry) {
  const text = `${entry.id} ${entry.title}`.toLowerCase();

  if (text.includes("arrival") || text.includes("arctic")) {
    return ["arctic", "circle", "arrival"];
  }

  if (text.includes("santa")) {
    return ["santa", "village", "night", "dusk"];
  }

  if (text.includes("campfire") || text.includes("fire")) {
    return ["campfire", "fire", "warmth"];
  }

  return text
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3);
}

function getBestStoryPhoto(entry: JournalEntry, photos: Photo[], usedPhotoIds: Set<string>) {
  const selectedPhoto = entry.storyPhotoId ? photos.find((photo) => photo.id === entry.storyPhotoId) : undefined;
  if (selectedPhoto) {
    return selectedPhoto;
  }

  const keywords = getStoryKeywords(entry);
  const scoredPhotos = photos
    .filter((photo) => !usedPhotoIds.has(photo.id))
    .map((photo) => {
      const searchable = `${photo.id} ${photo.originalFilename} ${photo.caption ?? ""}`.toLowerCase();
      const score = keywords.reduce((total, keyword) => total + (searchable.includes(keyword) ? 1 : 0), 0);
      return { photo, score };
    })
    .sort((first, second) => second.score - first.score);

  return scoredPhotos.find((item) => item.score > 0)?.photo ?? photos.find((photo) => !usedPhotoIds.has(photo.id));
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

function StoryMomentCard({ entry, index, photo }: { entry: JournalEntry; index: number; photo: Photo | undefined }) {
  return (
    <article className="travel-soft-panel grid overflow-hidden rounded-[1.25rem] lg:grid-cols-[11rem_1fr]" data-music-zone={`${entry.title} ${entry.body}`}>
      <div className="bg-[color:var(--paper-soft)]">
        {photo && isRenderablePhoto(photo) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={photo.caption ?? entry.title} className="h-40 w-full object-cover lg:h-full" src={photo.storageKey} />
        ) : (
          <div className="grid h-40 place-items-center p-4 text-center text-sm text-[color:var(--muted)] lg:h-full">Photo moment ready</div>
        )}
      </div>
      <div className="p-4">
        <p className="travel-kicker text-xs">Moment {index + 1}</p>
        <h3 className="travel-hand mt-2 line-clamp-2 text-xl font-semibold leading-tight text-[color:var(--ink)]">{entry.title}</h3>
        <p className="travel-muted mt-3 line-clamp-3 text-sm leading-6">{clampWords(getFirstSentence(entry.body), 34)}</p>
        <p className="travel-kicker mt-4 text-xs">
          {formatDate(entry.entryDate)} / {entry.mood ?? "memory"}
        </p>
      </div>
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

function VisitorScan({
  featurePhotoCount,
  readingMinutes,
  season,
  trip,
}: {
  featurePhotoCount: number;
  readingMinutes: number;
  season: string;
  trip: { city: string; country: string; summary: string; slug: string; title: string };
}) {
  return (
    <section className="travel-soft-panel rounded-[1.5rem] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-[9rem]">
          <p className="travel-kicker text-xs">Visitor scan</p>
          <p className="mt-1 text-xs font-semibold text-amber-800">Before you read</p>
        </div>
        <dl className="grid flex-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Best for", "Winter mood, family memories, slow photos"],
          ["Season", season],
          ["Base", `${trip.city}, ${trip.country}`],
          ["Read", `${readingMinutes} min`],
          ["Photo mood", featurePhotoCount > 0 ? "Snow, warm lights, Arctic quiet" : "Album ready"],
        ].map(([label, value], index) => (
          <div
            className={`rounded-2xl border px-3 py-2 ${
              ["border-rose-100 bg-rose-50/80", "border-sky-100 bg-sky-50/80", "border-amber-100 bg-amber-50/80", "border-teal-100 bg-teal-50/80"][
                index % 4
              ]
            }`}
            key={label}
          >
            <dt className="travel-kicker text-[0.65rem]">{label}</dt>
            <dd className="mt-1 line-clamp-1 leading-5 text-[color:var(--muted)]">{value}</dd>
          </div>
        ))}
        </dl>
      </div>
    </section>
  );
}

function CompactReaderGuide({
  featurePhotoCount,
  placesCount,
  readingMinutes,
  storyCount,
}: {
  featurePhotoCount: number;
  placesCount: number;
  readingMinutes: number;
  storyCount: number;
}) {
  return (
    <section className="travel-soft-panel rounded-2xl px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-[18rem]">
          <p className="travel-kicker text-xs">Reader guide</p>
          <p className="travel-muted mt-1 line-clamp-2 text-sm">Support text stays short here; the main story carries the emotion.</p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          {[
            ["Story", storyCount > 0 ? `${storyCount} notes / ${readingMinutes} min` : "Draft ready", "border-rose-100 bg-rose-50 text-rose-950"],
            ["Photos", featurePhotoCount > 0 ? `${featurePhotoCount} featured` : "Album ready", "border-amber-100 bg-amber-50 text-amber-950"],
            ["Stops", placesCount > 0 ? `${placesCount} saved` : "Add later", "border-teal-100 bg-teal-50 text-teal-950"],
          ].map(([label, value, tone]) => (
            <MemoryChip key={label} label={label} tone={tone} value={value} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function generateStaticParams() {
  return getTripDetailsByStartDate().map((trip) => ({ slug: trip.slug }));
}

export async function generateMetadata({ params }: TripDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { content } = await readContent();
  const trip = content.trips.find((item) => item.slug === slug);

  if (!trip) {
    return {};
  }

  const coverPhoto =
    trip.photos.find((photo) => photo.id === trip.coverPhotoId && isRenderablePhoto(photo)) ??
    trip.photos.find(isRenderablePhoto);
  const title = `${trip.title} - ${trip.city}, ${trip.country}`;
  const description = trip.summary.slice(0, 155);

  return {
    description,
    openGraph: {
      description,
      images: coverPhoto ? [{ alt: coverPhoto.caption ?? trip.title, url: coverPhoto.storageKey }] : [],
      title,
      type: "article",
      url: `/trips/${trip.slug}`,
    },
    title,
  };
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
  const renderablePhotos = trip.photos.filter(isRenderablePhoto);
  const readingMinutes = getReadingMinutes(trip.journalEntries);
  const seasonLabel = getSeasonLabel(trip.startDate);
  const heroSummary = clampWords(trip.summary, 58);
  const usedStoryPhotoIds = new Set<string>();
  const storyMoments = trip.journalEntries.map((entry, index) => {
    const photo = getBestStoryPhoto(entry, renderablePhotos, usedStoryPhotoIds);
    if (photo) {
      usedStoryPhotoIds.add(photo.id);
    }

    return { entry, index, photo };
  });
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelBlogPosting",
    dateModified: trip.updatedAt,
    datePublished: trip.createdAt,
    description: trip.summary,
    headline: trip.title,
    image: coverPhoto ? [coverPhoto.storageKey] : undefined,
    locationCreated: {
      "@type": "Place",
      address: `${trip.city}, ${trip.country}`,
      name: `${trip.city}, ${trip.country}`,
    },
    mainEntityOfPage: `https://travelos2-63r3.vercel.app/trips/${trip.slug}`,
  };

  return (
    <main className="travel-shell">
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} type="application/ld+json" />
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
              <p className="travel-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">{heroSummary}</p>
              <div className="mt-6">
                <ShareActions description={trip.summary} path={`/trips/${trip.slug}`} title={trip.title} />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  ["Season", seasonLabel, "border-sky-100 bg-sky-50 text-sky-950"],
                  ["Mood", trip.journalEntries[0]?.mood ?? "Memory", "border-rose-100 bg-rose-50 text-rose-950"],
                  ["Photos", `${trip.photos.length}`, "border-amber-100 bg-amber-50 text-amber-950"],
                  ["Cost", formatMoney(trip.totalCost), "border-teal-100 bg-teal-50 text-teal-950"],
                ].map(([label, value, tone]) => (
                  <MemoryChip key={label} label={label} tone={tone} value={value} />
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
          <VisitorScan featurePhotoCount={featurePhotos.length} readingMinutes={readingMinutes} season={seasonLabel} trip={trip} />
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

      <section className="mx-auto grid max-w-6xl gap-5 px-4 py-7 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:px-10">
        <div className="space-y-5">
          <section className="travel-panel rounded-2xl p-4 sm:p-5">
            <SectionHeader kicker="Overview" title="Trip memory" />
            <p className="travel-muted mt-3 line-clamp-3 text-sm leading-6">
              {clampWords(
                "This page is shaped for readers first: the story, useful stops, photo memories, and practical records stay together so it can work as both a family archive and a public travel note.",
                42,
              )}
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-4">
              {[
                ["Base city", trip.city],
                ["Coordinates", trip.coordinates ? `${trip.coordinates.latitude}, ${trip.coordinates.longitude}` : "Not mapped"],
                ["Journal entries", String(trip.journalEntries.length)],
                ["Saved places", String(trip.places.length)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="travel-kicker text-[0.65rem]">{label}</dt>
                  <dd className="mt-1 line-clamp-1 text-sm font-semibold text-[color:var(--ink)]">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <CompactReaderGuide
            featurePhotoCount={featurePhotos.length}
            placesCount={trip.places.length}
            readingMinutes={readingMinutes}
            storyCount={trip.journalEntries.length}
          />

          {trip.journalEntries.length > 0 ? (
            <section className="travel-panel rounded-2xl p-4 sm:p-5">
              <SectionHeader kicker="Story route" title="Read the journey through its key moments" />
              <p className="travel-muted mt-3 line-clamp-2 text-sm leading-6">
                A visitor should understand the emotional path quickly. Each moment keeps one photo and one short text preview.
              </p>
              <div className="mt-5 grid gap-3">
                {storyMoments.map(({ entry, index, photo }) => (
                  <StoryMomentCard entry={entry} index={index} key={entry.id} photo={photo} />
                ))}
              </div>
            </section>
          ) : null}

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

        <aside className="space-y-5 lg:sticky lg:top-5">
          <section className="travel-panel rounded-2xl p-4">
            <SectionHeader kicker="Story contents" title="On this page" />
            <p className="travel-muted mt-2 text-xs leading-5">Writing guide: keep each moment title under 12 words and preview text under 35 words.</p>
            <div className="mt-4 grid gap-2">
              {storyMoments.map(({ entry, photo }, index) => (
                <article className="grid grid-cols-[3.25rem_1fr] gap-3 rounded-2xl border border-[color:var(--line)] bg-white/60 p-2" key={entry.id}>
                  <div className="overflow-hidden rounded-xl bg-[color:var(--paper-soft)]">
                    {photo && isRenderablePhoto(photo) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={photo.caption ?? entry.title} className="h-14 w-full object-cover" src={photo.storageKey} />
                    ) : (
                      <div className="grid h-14 place-items-center text-xs text-[color:var(--muted)]">{index + 1}</div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="travel-kicker text-[0.65rem]">Moment {index + 1}</p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-[color:var(--ink)]">{entry.title}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="travel-panel rounded-2xl p-4">
            <SectionHeader kicker="Places" title="Saved stops" />
            <div className="mt-4">
              {trip.places.map((place) => (
                <PlaceRow key={place.id} place={place} />
              ))}
            </div>
          </section>
          <section className="travel-panel rounded-2xl p-4">
            <SectionHeader kicker="Costs" title="Tracked spend" />
            <div className="mt-4">
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
