import type { TripDetail } from './types';
export type EditorCatalogItem = Pick<TripDetail, 'id'|'title'|'startDate'|'endDate'|'updatedAt'>;

export async function loadSelectedEditorTrip(id: string, headers: HeadersInit, signal: AbortSignal, request: typeof fetch = fetch): Promise<TripDetail> {
  const response = await request(`/api/trips/content?id=${encodeURIComponent(id)}`, {cache:'no-store', headers, signal});
  if (!response.ok) throw new Error('這篇遊記暫時未能載入');
  const data = await response.json();
  if (data.trip?.id !== id) throw new Error('讀取的遊記不一致，請再試一次');
  return data.trip;
}

/** A failed or stalled read is never an empty family library. */
export async function loadEditorLibrary(headers: HeadersInit, request: typeof fetch = fetch, timeoutMs = 8000): Promise<{trips: EditorCatalogItem[]}> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await request('/api/trips/catalog', {cache:'no-store', headers, signal:AbortSignal.timeout(timeoutMs)});
      if (!response.ok) throw new Error('暫時無法讀取行程，請再試一次。');
      const data = await response.json();
      if (!Array.isArray(data.trips)) throw new Error('行程尚未完整讀取，請再試一次。');
      return data;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
