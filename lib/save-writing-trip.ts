import type { TripDetail } from './types.ts';

/** Save only the selected work; keep the acknowledged server version for the next edit. */
export async function saveWritingTrip(trip: TripDetail, baseUpdatedAt: string, headers: HeadersInit, request: typeof fetch = fetch) {
  const response = await request('/api/trips/content', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ trip, baseUpdatedAt }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Trip journal save failed.');
  const saved = data.trip as TripDetail | undefined;
  if (saved?.id !== trip.id) throw new Error('保存的作品回應不一致，請保留草稿後重試。');
  return { trip: saved, warning: data.warning as string | undefined };
}
