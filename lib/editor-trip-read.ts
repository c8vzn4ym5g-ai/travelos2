import { getWarehouseTripRecord } from '@/lib/drive-warehouse';
import { parseDriveTripRecord } from '@/lib/drive-trips';
import { prepareFamilyEditorTrips, VANITY_CREW_HELD_TRIP_IDS } from '@/lib/trip-series';

/** Same selected record as the public reader, keeping the editable draft. */
export async function readEditorTripRecord(id: string, request?: typeof fetch) {
  if (!/^trip_[a-zA-Z0-9_-]+$/.test(id) || (VANITY_CREW_HELD_TRIP_IDS as readonly string[]).includes(id)) return null;
  const raw = await getWarehouseTripRecord(`travelos__trip__${id}.json`, request);
  if (raw === null) return null;
  const trip = parseDriveTripRecord(raw);
  if (!trip || trip.id !== id) throw new Error('家庭遊記資料不一致');
  return prepareFamilyEditorTrips([trip])[0] ?? null;
}
