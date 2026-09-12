"use client";

import { useState } from "react";
import { isTripPhotoVideo } from "@/lib/trip-photo";
import type { Photo } from "@/lib/types";
import type { PromoVideo } from "@/lib/promo-videos";

export function ReaderPhoto({ photo, priority = false }: { photo: Photo; priority?: boolean }) {
  return isTripPhotoVideo(photo) ? (
    <video aria-label={photo.caption ?? photo.originalFilename} className="max-h-[70vh] w-full bg-black object-contain" controls playsInline preload="none" src={photo.storageKey} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={photo.caption ?? photo.originalFilename} className="max-h-[70vh] w-full object-contain" decoding="async" loading={priority ? "eager" : "lazy"} src={photo.storageKey} />
  );
}

export function ReaderAlbum({ photos }: { photos: Photo[] }) {
  const [visible, setVisible] = useState(0);
  if (!photos.length) return null;
  return <section aria-label="完整相簿" className="travel-panel rounded-3xl p-5 sm:p-7">
    <h2 className="travel-hand text-2xl font-semibold">旅途相簿</h2>
    <p className="travel-muted mt-2 text-sm">故事之外，還有 {photos.length} 個旅途片刻。</p>
    {visible > 0 ? <div className="mt-5 grid gap-5 sm:grid-cols-2">{photos.slice(0, visible).map(photo => <figure className="min-w-0 overflow-hidden rounded-2xl bg-[color:var(--paper-soft)]" key={photo.id}><ReaderPhoto photo={photo} />{photo.caption ? <figcaption className="p-3 text-sm leading-6">{photo.caption}</figcaption> : null}</figure>)}</div> : null}
    {visible < photos.length ? <button className="travel-chip mt-4 min-h-11 rounded-full px-5 py-3 text-sm font-semibold" onClick={() => setVisible(count => count + 8)} type="button">{visible === 0 ? `打開相簿（${photos.length}）` : `再看 ${Math.min(8, photos.length - visible)} 個片刻`}</button> : null}
    {visible > 0 ? <button className="travel-chip ml-2 mt-4 min-h-11 rounded-full px-5 py-3 text-sm" onClick={() => setVisible(0)} type="button">收起相簿</button> : null}
  </section>;
}

export function ReaderFilm({ videos, poster }: { videos: PromoVideo[]; poster?: string }) {
  const [failed, setFailed] = useState(false);
  const video = videos[0];
  if (!video) return null;
  if (failed) return <p role="status" className="travel-muted text-center text-sm">短片暫時無法播放，先往下看這段旅程。</p>;
  return <section aria-label="旅程短片" className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-black">
    <video aria-label={video.title} className="max-h-[72vh] w-full object-contain" controls playsInline preload="none" poster={poster} src={video.src} onError={() => setFailed(true)} />
  </section>;
}
