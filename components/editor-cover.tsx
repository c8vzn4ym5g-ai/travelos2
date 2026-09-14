"use client";
import { ReaderPhoto } from "@/components/reader-media";
import { tripCover, setTripCover } from "@/lib/trip-cover";
import type { TripDetail } from "@/lib/types";

export function EditorCover({trip, onChange, onChoose}: {trip: TripDetail; onChange: (trip: TripDetail) => void; onChoose: () => void}) {
  const cover = tripCover(trip);
  const publishedCover = trip.publishedSnapshot ? tripCover(trip.publishedSnapshot) : null;
  const differs = publishedCover && publishedCover.id !== cover?.id;
  return <section className="mt-5 rounded-3xl border border-sky-100 bg-white p-4 sm:p-6" aria-label="遊記封面">
    <h2 className="text-xl font-semibold">遊記封面</h2>
    <p className="mt-2 text-sm leading-6 text-zinc-600">這張照片會出現在旅行目錄和遊記開頭。儲存保留工作稿；按「更新公開版」後，讀者才會看到修改。</p>
    <div className="mt-4 overflow-hidden rounded-2xl">{cover ? <ReaderPhoto photo={cover} /> : <p>尚未選擇封面照片。</p>}</div>
    <button className="mt-3 min-h-11 rounded-full bg-sky-800 px-5 py-3 text-white" onClick={onChoose} type="button">更換封面照片</button>
    {cover ? <label className="mt-4 block text-sm">封面照片說明<input aria-label="封面照片說明" className="mt-2 min-h-11 w-full rounded-xl border p-3 text-base" value={cover.caption ?? ""} onChange={event => onChange({...trip, photos: trip.photos.map(photo => photo.id === cover.id ? {...photo, caption: event.target.value} : photo)})} /></label> : null}
    {differs ? <details className="mt-4 rounded-2xl bg-stone-50 p-4"><summary className="cursor-pointer font-semibold">目前公開的封面不同 · 查看</summary><div className="mt-3"><ReaderPhoto photo={publishedCover} /></div><button type="button" className="mt-3 min-h-11 rounded-full border px-4 py-2" onClick={() => onChange(setTripCover(trip, publishedCover))}>將這張放回工作稿編輯</button></details> : null}
  </section>;
}
