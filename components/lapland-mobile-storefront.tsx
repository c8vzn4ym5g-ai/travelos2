"use client";

import Link from "next/link";
import { ReaderAlbum, ReaderPhoto } from "@/components/reader-media";
import { BookingBand } from "@/components/booking-band";
import { StorefrontHomeLink } from "@/components/storefront-home-link";
import { JournalSpendPanel } from "@/components/journal-spend";
import { LaplandMoreCut } from "@/components/lapland-more-cut";
import { LaplandPlaceKnowledge } from "@/components/lapland-place-knowledge";
import { LaplandPublicCut } from "@/components/lapland-public-cut";
import { LaplandStorefrontGlance } from "@/components/lapland-storefront-glance";
import { ShareActions } from "@/components/share-actions";
import { LAPLAND_PHOTO_CREDITS, LAPLAND_SEASON_LABEL } from "@/lib/lapland-storefront-copy";
import { getLaplandBooking } from "@/lib/travelpayouts";
import type { Photo, TripDetail } from "@/lib/types";

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

export function LaplandMobileStorefront({
  trip,
}: {
  coverPhoto: Photo | undefined;
  trip: TripDetail;
}) {
  const albumPhotos = trip.photos.filter(isRenderablePhoto);

  return (
    <main className="travel-shell bg-[color:var(--paper)]" data-lapland-mobile-storefront="">
      <section className="relative w-full" data-lapland-mobile-hero="">
        <div className="absolute left-3 top-3 z-20 flex flex-wrap gap-2">
          <StorefrontHomeLink className="travel-chip inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs font-semibold" />
          <Link
            className="travel-chip inline-flex min-h-11 items-center rounded-full px-3 py-2 text-xs font-semibold"
            href="/trips"
          >
            旅程
          </Link>
        </div>
        <LaplandPublicCut bleed phoneFold />
        <div className="pointer-events-none absolute inset-x-0 bottom-[72px] z-20 bg-gradient-to-t from-black/55 to-transparent px-4 pb-3 pt-8">
          <p className="travel-kicker text-[0.6rem] text-white/80">那年冬天 · {LAPLAND_SEASON_LABEL}</p>
          <h1 className="travel-hand mt-0.5 line-clamp-2 text-lg font-semibold leading-tight text-white">{trip.title}</h1>
        </div>
      </section>

      <div className="px-4 py-5">
        <section className="mt-7 space-y-6" aria-label="旅程故事">
          <h2 className="travel-hand text-2xl font-semibold">旅途裡的故事</h2>
          <nav aria-label="故事章節" className="flex flex-wrap gap-2">{trip.journalEntries.map(entry => <a className="travel-chip min-h-11 rounded-full px-4 py-3 text-sm" href={`#story-${entry.id}`} key={entry.id}>{entry.title}</a>)}</nav>
          {trip.journalEntries.map(entry => {
            const photo = albumPhotos.find(photo => photo.id === entry.storyPhotoId);
            return <article className="scroll-mt-6 overflow-hidden rounded-3xl bg-white/70" id={`story-${entry.id}`} key={entry.id}>
              {photo ? <ReaderPhoto photo={photo} /> : null}
              <div className="p-5"><h3 className="travel-hand text-xl font-semibold">{entry.title}</h3><div className="mt-3 space-y-3">{entry.body.split("\n\n").map((paragraph, index) => <p className="travel-muted text-base leading-8" key={index}>{paragraph}</p>)}</div></div>
            </article>;
          })}
        </section>
        <div className="mt-7" data-lapland-mobile-album=""><ReaderAlbum photos={albumPhotos} /></div>

        <div className="mt-7">
          <LaplandMoreCut>
            <LaplandStorefrontGlance />
            <section className="travel-panel rounded-2xl p-4">
              <p className="travel-kicker text-xs">Overview</p>
              <h2 className="travel-hand mt-2 text-2xl font-semibold">Trip memory</h2>
              <dl className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <dt className="travel-kicker text-[0.65rem]">Base city</dt>
                  <dd className="mt-1 text-sm font-semibold">{trip.city}</dd>
                </div>
                <div>
                  <dt className="travel-kicker text-[0.65rem]">Season</dt>
                  <dd className="mt-1 text-sm font-semibold">{LAPLAND_SEASON_LABEL}</dd>
                </div>
              </dl>
            </section>
            <LaplandPlaceKnowledge />
            <div>
              <ShareActions description={trip.summary} path={`/trips/${trip.slug}`} title={trip.title} />
            </div>
            <JournalSpendPanel costs={trip.costs} slug={trip.slug} startDate={trip.startDate} totalCost={trip.totalCost} />
            <BookingBand destination={getLaplandBooking()} />
            <footer className="travel-muted text-[0.7rem] leading-6" data-photo-credits="">
              <p className="travel-kicker text-[0.65rem]">圖片出處 / Photo credits</p>
              {LAPLAND_PHOTO_CREDITS.map((credit) => (
                <p key={credit.id}>
                  {credit.lineZh} {credit.line}
                </p>
              ))}
            </footer>
          </LaplandMoreCut>
        </div>
      </div>
    </main>
  );
}
