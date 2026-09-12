import type { TripDetail } from "./types.ts";
import { projectJournalForReader } from "./journal-entry-kind.ts";

function snapshot(trip: TripDetail): NonNullable<TripDetail['publishedSnapshot']> {
  const { publishedSnapshot: previous, ...content } = trip;
  void previous;
  return structuredClone(content);
}

/** Save the working copy; publishing is a separate, explicit user action. */
export function prepareTripSave(current: TripDetail, draft: TripDetail, publish = false): TripDetail {
  const visible = current.visibility !== 'private';
  const visibility = publish ? 'public' : visible && draft.visibility !== 'private' ? current.visibility : 'private';
  return {
    ...draft, visibility,
    publishedSnapshot: publish ? snapshot({ ...draft, visibility: 'public' })
      : current.publishedSnapshot ?? (visible ? snapshot(current) : undefined),
  };
}

/** Public pages can never receive an unpublished working copy. */
export function publishedTrip(trip: TripDetail): TripDetail | null {
  if (trip.visibility === 'private') return null;
  return projectJournalForReader({ ...(trip.publishedSnapshot ?? snapshot(trip)), publishedSnapshot: undefined });
}
