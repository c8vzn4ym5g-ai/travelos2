import { readDriveTrip } from '@/lib/drive-trips';

/** Same selected record as the public reader, keeping the editable draft. */
export async function readEditorTripRecord(id: string, request?: typeof fetch) {
  return readDriveTrip(id, request, 35_000);
}
