/** An explicit but unavailable batch must never select a different family's batch. */
export function selectWriteMoment<T extends { id: string }>(moments: T[], requestedId: string | null): T | null {
  return requestedId !== null ? moments.find((moment) => moment.id === requestedId) ?? null : moments[0] ?? null;
}
