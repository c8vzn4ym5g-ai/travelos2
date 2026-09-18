import type { JournalEntry, TripDetail } from "./types.ts";

export const JOURNAL_ENTRY_KINDS = [
  ["unreviewed", "尚未核對"],
  ["plan", "行前計畫（不放入公開遊記）"],
  ["actual", "已確認的實際紀錄"],
  ["public", "已整理的公開文稿"],
] as const;

export function journalEntryKind(entry: Pick<JournalEntry, "entryKind">) {
  return JOURNAL_ENTRY_KINDS.some(([kind]) => kind === entry.entryKind) ? entry.entryKind! : "unreviewed";
}

/** Reader projection only. The saved source and its plan remain untouched. */
export function projectJournalForReader(trip: TripDetail): TripDetail {
  const planIds = new Set(trip.journalEntries.filter(entry => journalEntryKind(entry) === "plan").map(entry => entry.id));
  return {
    ...trip,
    journalEntries: trip.journalEntries.filter(entry => !planIds.has(entry.id)),
    places: (trip.places ?? []).map(place => ({ ...place, notes: null })),
    costs: (trip.costs ?? []).map(cost => ({ ...cost, notes: null })),
    travelRoute: (trip.travelRoute ?? []).filter(segment => !segment.linkedJournalEntryId || !planIds.has(segment.linkedJournalEntryId)).map(segment => ({ ...segment, note: null })),
  };
}
