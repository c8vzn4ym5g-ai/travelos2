import type { TripDetail } from "./types.ts";
type Snapshot = { trips: TripDetail[]; source: "blob" | "drive" | "seed"; at: number };
let snapshot: { owner: string; value: Snapshot } | null = null;
export function rememberEditorLibrary(owner: string, trips: TripDetail[], source: Snapshot["source"]) {
  snapshot = { owner, value: { trips, source, at: Date.now() } };
}
export function recalledEditorLibrary(owner: string) {
  return snapshot?.owner === owner && Date.now() - snapshot.value.at < 300_000 ? snapshot.value : null;
}
/** Only confirmed server results belong in the shared navigation snapshot. */
export function rememberSavedEditorTrips(owner: string, saved: TripDetail[]) {
  const current = recalledEditorLibrary(owner);
  if (!current) return;
  const byId = new Map(current.trips.map(trip => [trip.id, trip]));
  for (const trip of saved) byId.set(trip.id, trip);
  rememberEditorLibrary(owner, [...byId.values()], current.source);
}
