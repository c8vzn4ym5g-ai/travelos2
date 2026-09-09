import { getDriveAccess } from "@/lib/drive-warehouse";
import { VANITY_CREW_HELD_TRIP_IDS, prepareFamilyEditorTrips, prepareTripForWarehouse } from "@/lib/trip-series";
import type { TripDetail } from "@/lib/types";

const prefix = "travelos__trip__";
const heldTripFileNames = new Set(VANITY_CREW_HELD_TRIP_IDS.map((id) => `${prefix}${id}.json`));

export type DriveTripFile = {
  id: string;
  name: string;
  modifiedTime?: string;
};

async function connection() {
  const access = await getDriveAccess();
  if (!access) throw new Error("家庭儲存暫時無法連接，變更尚未儲存。");
  return access;
}

function newerDriveFile(candidate: DriveTripFile, current: DriveTripFile | undefined) {
  if (!current) {
    return true;
  }
  return (candidate.modifiedTime ?? "") >= (current.modifiedTime ?? "");
}

export function selectLatestDriveTripFiles(files: DriveTripFile[]) {
  const byName = new Map<string, DriveTripFile>();
  for (const file of files) {
    if (!file.name.startsWith(prefix) || !file.name.endsWith(".json")) {
      continue;
    }
    const current = byName.get(file.name);
    if (newerDriveFile(file, current)) {
      byName.set(file.name, file);
    }
  }
  return [...byName.values()];
}

export function selectDriveTripFilesForRead(files: DriveTripFile[]) {
  return selectLatestDriveTripFiles(files).filter((file) => !heldTripFileNames.has(file.name));
}

export function preferLatestDriveTrips(
  trips: Array<{ modifiedTime?: string; trip: TripDetail }>,
) {
  const byId = new Map<string, { modifiedTime?: string; trip: TripDetail }>();
  for (const item of trips) {
    const current = byId.get(item.trip.id);
    if (!current || (item.modifiedTime ?? "") >= (current.modifiedTime ?? "")) {
      byId.set(item.trip.id, item);
    }
  }
  return [...byId.values()].map((item) => item.trip);
}

export async function readDriveTrips(): Promise<TripDetail[]> {
  const access = await connection();
  const query = new URLSearchParams({
    q: `'${access.folderId}' in parents and trashed = false and name contains '${prefix}'`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "1000",
  });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, {
    headers: { Authorization: `Bearer ${access.token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("無法讀取家庭遊記。");
  const listing = await response.json() as { files: DriveTripFile[] };
  const files = selectDriveTripFilesForRead(listing.files ?? []);
  const loaded = await Promise.all(files.map(async (file) => {
    const result = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: { Authorization: `Bearer ${access.token}` },
      cache: "no-store",
    });
    if (!result.ok) throw new Error("無法讀取家庭遊記。");
    const trip = await result.json() as TripDetail;
    return { modifiedTime: file.modifiedTime, trip };
  }));
  return prepareFamilyEditorTrips(preferLatestDriveTrips(loaded));
}

export async function writeDriveTrip(trip: TripDetail) {
  const payload = prepareTripForWarehouse(trip);
  const access = await connection();
  const name = `${prefix}${payload.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  const headers = { Authorization: `Bearer ${access.token}` };
  const query = new URLSearchParams({
    q: `'${access.folderId}' in parents and trashed = false and name = '${name}'`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "10",
  });
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, { headers, cache: "no-store" });
  if (!found.ok) throw new Error("尚未儲存，請再試一次。");
  const files = await found.json() as { files: DriveTripFile[] };
  let id = selectLatestDriveTripFiles(files.files ?? [])[0]?.id;
  if (!id) {
    const created = await fetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ name, parents: [access.folderId], mimeType: "application/json" }),
    });
    if (!created.ok) throw new Error("尚未儲存，請再試一次。");
    id = (await created.json() as { id: string }).id;
  }
  const saved = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!saved.ok) throw new Error("尚未儲存，請再試一次。");
  return payload;
}
