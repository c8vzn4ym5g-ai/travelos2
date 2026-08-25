import {
  LAPLAND_GARNISH_CREDIT_EN,
  LAPLAND_GARNISH_CREDIT_ZH,
  LAPLAND_VISUAL_PATH,
} from "@/lib/lapland-storefront-copy";
import type { Photo } from "@/lib/types";

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

export function LaplandVisualPath({ photos }: { photos: Photo[] }) {
  const photosById = new Map(photos.map((photo) => [photo.id, photo]));

  return (
    <section aria-label="Visual path" className="max-w-4xl" data-visual-path="">
      <p className="travel-kicker text-xs">路徑 / Path</p>
      <h2 className="travel-hand mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)] sm:text-3xl">
        拉普蘭，然後赫爾辛基 / Lapland, then Helsinki
      </h2>
      <div className="mt-5 grid gap-4">
        {LAPLAND_VISUAL_PATH.map((beat) => {
          const photo = photosById.get(beat.photoId);
          return (
            <article className="travel-soft-panel overflow-hidden rounded-[1.25rem]" data-visual-beat={beat.photoId} key={beat.photoId}>
              {photo && isRenderablePhoto(photo) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={photo.caption ?? beat.title} className="h-56 w-full object-cover sm:h-72" src={photo.storageKey} />
              ) : (
                <div className="grid h-40 place-items-center bg-[color:var(--paper-soft)] text-sm text-[color:var(--muted)]">
                  Photo pending
                </div>
              )}
              <div className="p-4">
                <p className="travel-kicker text-xs">{beat.kicker}</p>
                <h3 className="travel-hand mt-2 text-xl font-semibold leading-tight text-[color:var(--ink)]">{beat.title}</h3>
                <p className="travel-muted mt-2 text-sm leading-6">{beat.zh}</p>
                <p className="travel-muted mt-1 text-sm leading-6">{beat.en}</p>
                {beat.kind === "garnish" ? (
                  <p className="mt-3 text-xs leading-5 text-teal-900" data-garnish-credit="">
                    {LAPLAND_GARNISH_CREDIT_ZH} / {LAPLAND_GARNISH_CREDIT_EN}
                    {beat.credit ? ` · ${beat.credit}` : ""}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
