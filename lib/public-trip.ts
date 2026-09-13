import { getWarehousePublicHub } from '@/lib/drive-warehouse';
import { readDriveTrip } from '@/lib/drive-trips';
import { withDriveReadBudget } from '@/lib/drive-read-budget';
import { parseHubCard } from '@/lib/public-hub';
import { publishedTrip } from '@/lib/trip-publication';
import type { TripDetail } from '@/lib/types';

/** One public index and one selected file; never hydrate the whole library.
 * Null means absent/unpublished. Storage failures remain errors for a retry UI.
 */
export async function readPublicTripBySlug(
  slug: string,
  request?: typeof fetch,
  timeoutMs?: number,
): Promise<TripDetail | null> {
  return withDriveReadBudget(request, async read => {
    const raw = await getWarehousePublicHub(read) as {trips?: unknown[]};
    if (!Array.isArray(raw?.trips)) throw new Error('公開遊記目錄暫時無法讀取，請再試一次。');
    const cards = raw.trips.flatMap(record => { const card = parseHubCard(record); return card ? [card] : []; });
    const card = cards.find(card => card.slug === slug);
    if (!card) return null;
    const stored = await readDriveTrip(card.id, read, timeoutMs);
    if (!stored) return null;
    const visible = publishedTrip(stored);
    // An old index must never reveal a subsequently private trip or draft slug.
    return visible && visible.visibility !== 'private' && visible.id === card.id && visible.slug === slug ? visible : null;
  }, timeoutMs);
}
