"use client";

import { ReaderPhoto } from "@/components/reader-media";
import { JOURNAL_ENTRY_KINDS, journalEntryKind } from "@/lib/journal-entry-kind";
import type { TripDetail } from "@/lib/types";

/** Local working-copy preview. No save, publish or network request. */
export function TripDraftPreview({ trip, onBack }: { trip: TripDetail; onBack: () => void }) {
  return <main className="min-h-screen bg-[#f8f3ea] pb-12 text-zinc-900" data-trip-draft-preview="">
    <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-sky-100 bg-white/95 px-4 py-3">
      <button className="min-h-11 rounded-full border border-sky-200 px-5 py-3 text-sm font-semibold text-sky-900" onClick={onBack} type="button">← 返回編輯</button>
      <p className="text-sm text-zinc-600">工作稿預覽・尚未更新公開版</p>
    </header>
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="travel-hand break-words text-3xl font-semibold leading-tight">{trip.title}</h1>
      <p className="mt-4 whitespace-pre-line break-words leading-8 text-zinc-600">{trip.summary}</p>
      <div className="mt-8 space-y-8">{trip.journalEntries.map(entry => {
        const photo = trip.photos.find(photo => photo.id === entry.storyPhotoId);
        const kind = journalEntryKind(entry);
        const label = JOURNAL_ENTRY_KINDS.find(([key]) => key === kind)?.[1];
        return <article className="overflow-hidden rounded-3xl bg-white" key={entry.id}>
          {photo ? <ReaderPhoto photo={photo} /> : null}
          <div className="p-5 sm:p-8">
            <p className="text-xs text-sky-800">{label}</p>
            <h2 className="travel-hand mt-3 break-words text-2xl font-semibold">{entry.title}</h2>
            <div className="mt-4 space-y-4">{entry.body.split("\n\n").map((paragraph, index) => <p className="whitespace-pre-line break-words leading-8 text-zinc-700" key={index}>{paragraph}</p>)}</div>
          </div>
        </article>;
      })}</div>
    </div>
  </main>;
}
