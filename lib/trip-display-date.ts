import type { Trip } from "./types";

export function tripDisplayDate(trip: Pick<Trip, "startDate" | "publicDateLabel">): string {
  return trip.publicDateLabel ?? trip.startDate.slice(0, 7).replaceAll("-", ".");
}
