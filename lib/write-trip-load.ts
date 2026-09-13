import type { TripDetail } from './types';

export async function loadWritingTrips(headers: HeadersInit, request: typeof fetch = fetch): Promise<TripDetail[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await request('/api/trips/content', { cache: 'no-store', headers, signal: AbortSignal.timeout(20_000) });
      if (!response.ok) throw new Error('Trip list unavailable');
      const data = await response.json() as { content?: { trips?: TripDetail[] } };
      if (!Array.isArray(data.content?.trips)) throw new Error('Trip list incomplete');
      return data.content.trips;
    } catch (error) { lastError = error; }
  }
  throw lastError;
}
