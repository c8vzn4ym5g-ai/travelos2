"use client";
import { ReaderPhoto } from "@/components/reader-media";
import { tripCover } from "@/lib/trip-cover";
import type { TripDetail } from "@/lib/types";

/** Same in-memory working copy; no save, publication or trip refetch. */
export function EditorLivePreview({ trip }: { trip: TripDetail }) {
  const cover = tripCover(trip);
  return <aside className="editor-live-preview" aria-label="即時閱讀預覽"><header><span>閱讀預覽</span><small>修改會即時顯示 · 尚未發布</small></header><div className="editor-preview-body"><p className="jl-eyebrow">{trip.country} ／ {trip.city}</p><h2>{trip.title}</h2><p>{trip.summary}</p>{cover ? <ReaderPhoto photo={cover} /> : null}{trip.journalEntries.map(entry => {
    const photo = trip.photos.find(photo => photo.id === entry.storyPhotoId);
    return <section key={entry.id}>{photo ? <ReaderPhoto photo={photo} /> : null}<h3>{entry.title}</h3><p>{entry.body}</p></section>;
  })}</div></aside>;
}
