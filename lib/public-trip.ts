import { readDriveTrip } from '@/lib/drive-trips';
import { withDriveReadBudget } from '@/lib/drive-read-budget';
import { readPublicHubIndexForSlug } from '@/lib/public-hub';
import { publishedTrip } from '@/lib/trip-publication';
import type { TripDetail } from '@/lib/types';

/** One public index and one selected file; never hydrate the whole library.
 * Null means absent/unpublished. Storage failures remain errors for a retry UI.
 */
export async function readPublicTripBySlug(
  slug: string,
  request?: typeof fetch,
  timeoutMs?: number,
  selectedId?: string,
): Promise<TripDetail | null> {
  let stage = 'public-index';
  try { return await withDriveReadBudget(request, async read => {
    const cards = selectedId ? [] : await readPublicHubIndexForSlug(slug, read);
    const card = selectedId ? { id: selectedId, slug } : cards.find(card => card.slug === slug);
    if (!card || !/^trip_[a-zA-Z0-9_-]+$/.test(card.id)) return null;
    stage = 'selected-trip';
    const stored = await readDriveTrip(card.id, read, timeoutMs ?? 35_000);
    if (!stored) return null;
    const visible = publishedTrip(stored);
    // An old index must never reveal a subsequently private trip or draft slug.
    return visible && visible.visibility !== 'private' && visible.id === card.id && visible.slug === slug ? visible : null;
  }, timeoutMs ?? 35_000); }
  catch (error) {
    // Stage only: never log tokens, signed URLs, or private trip content.
    console.warn('[public-trip-read]', stage, error instanceof Error && /逾時|timed out/.test(error.message) ? 'timeout' : 'unavailable');
    throw error;
  }
}
