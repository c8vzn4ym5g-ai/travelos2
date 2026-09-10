import type { Trip } from "@/lib/types";

type TripVisibilityRecord = Pick<Trip, "visibility">;
type TripStartDateRecord = { startDate?: string | null };

export function isTripPublic(trip: TripVisibilityRecord) {
  return trip.visibility !== "private";
}

/** Drive crew shelves can store `startDate: null`. Sort must not call localeCompare on null. */
export function compareTripsByStartDateDesc(first: TripStartDateRecord, second: TripStartDateRecord) {
  return (second.startDate ?? "").localeCompare(first.startDate ?? "");
}
