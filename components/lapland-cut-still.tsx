import type { Photo } from "@/lib/types";

export function LaplandCutStill({ photo }: { photo: Photo }) {
  return (
    <figure className="max-w-4xl" data-lapland-cut-still="">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={photo.caption ?? ""}
        className="mx-auto max-h-[70vh] w-auto max-w-full rounded-[1.25rem] bg-[color:var(--paper-soft)] object-contain"
        src={photo.storageKey}
      />
      {photo.caption ? <figcaption className="travel-muted mt-3 text-sm leading-6">{photo.caption}</figcaption> : null}
    </figure>
  );
}
