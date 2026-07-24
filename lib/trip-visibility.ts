import type { Trip } from "@/lib/types";

type TripVisibilityRecord = Pick<Trip, "visibility">;

export function isTripPublic(trip: TripVisibilityRecord) {
  return trip.visibility !== "private";
}
