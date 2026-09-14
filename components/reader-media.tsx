"use client";

import { useState } from "react";
import { isTripPhotoVideo } from "@/lib/trip-photo";
import type { Photo } from "@/lib/types";
import type { PromoVideo } from "@/lib/promo-videos";


export function ReaderPhoto({ photo, priority = false }: { photo: Photo; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const src = attempt && photo.storageKey.startsWith("/api/") ? photo.storageKey + (photo.storageKey.includes("?") ? "&" : "?") + "retry=" + attempt : photo.storageKey;
  if (failed) return <div role="status" className="grid min-h-48 place-items-center gap-3 bg-stone-100 p-6 text-center"><p>這張照片未能載入</p><button className="min-h-11 rounded-full border bg-white px-5 py-3" type="button" onClick={() => { setAttempt(Date.now()); setFailed(false); }}>重新載入照片</button></div>;
  return isTripPhotoVideo(photo) ? (
    <video aria-label={photo.caption ?? photo.originalFilename} className="max-h-[70vh] w-full bg-black object-contain" controls playsInline preload="none" src={photo.storageKey} />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={src} alt={photo.caption ?? photo.originalFilename} className="max-h-[70vh] w-full object-contain" decoding="async" loading={priority ? "eager" : "lazy"} src={src} onError={() => setFailed(true)} />
  );
}

export function ReaderAlbum({ photos }: { photos: Photo[] }) {
  const [visible, setVisible] = useState(6);
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
  const [selected, setSelected] = useState(0);
  const video = videos[selected] ?? videos[0];
  if (!video) return null;
  return <section aria-label="旅程短片" className="mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-black">
    {videos.length > 1 ? <div aria-label="選擇短片版本" className="flex flex-wrap gap-2 p-3">{videos.map((item, index) => <button aria-pressed={item === video} className={`min-h-11 min-w-0 max-w-full rounded-xl px-3 py-2 text-left text-sm leading-6 break-words ${item === video ? "bg-white text-black" : "bg-white/15 text-white"}`} key={item.src} onClick={() => { setSelected(index); setFailed(false); }} type="button">{item.title}</button>)}</div> : null}
    {failed ? <p role="status" className="p-4 text-center text-sm text-white">短片暫時無法播放。<button className="ml-2 min-h-11 underline" onClick={() => setFailed(false)} type="button">重試</button></p> : <video key={video.src} aria-label={video.title} className="max-h-[72vh] w-full object-contain" controls playsInline preload="none" poster={video.poster ?? poster} src={video.src} onError={() => setFailed(true)} />}
    <div className="space-y-2 px-4 py-4 text-white">
      <p className="font-semibold">{video.title}</p>
      <p className="text-sm leading-6 text-white/75">{video.caption}</p>
      <a className="inline-flex min-h-11 items-center underline underline-offset-4" href={video.src} download>下載短片</a>
      {video.credit ? <p className="text-xs leading-5 text-white/60"><a href={video.credit.href} target="_blank" rel="noreferrer">{video.credit.label}</a></p> : null}
    </div>
  </section>;
}
