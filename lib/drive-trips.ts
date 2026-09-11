import { getDriveAccess, getWarehouseTripBundle, putWarehouseTrip } from "@/lib/drive-warehouse";
import { invalidatePublicHubCache } from "@/lib/public-hub";
import { VANITY_CREW_HELD_TRIP_IDS, prepareFamilyEditorTrips, prepareTripForWarehouse } from "@/lib/trip-series";
import type { TripDetail } from "@/lib/types";

const prefix = "travelos__trip__";
const heldTripFileNames = new Set(VANITY_CREW_HELD_TRIP_IDS.map((id) => `${prefix}${id}.json`));
const heldTripIdSet = new Set<string>(VANITY_CREW_HELD_TRIP_IDS);

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

export function duplicateDriveTripFileIds(files: DriveTripFile[], keepId: string) {
  return files.filter((file) => file.id !== keepId).map((file) => file.id);
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
    if (!item.trip?.id) {
      continue;
    }
    const current = byId.get(item.trip.id);
    if (!current || (item.modifiedTime ?? "") >= (current.modifiedTime ?? "")) {
      byId.set(item.trip.id, item);
    }
  }
  return [...byId.values()].map((item) => item.trip);
}

/** Apps Script `op=item` wraps JSON as `{ moment, updatedAt }`. Live trip files must still parse. */
export function parseDriveTripRecord(raw: unknown): TripDetail | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const nested =
    typeof record.id !== "string" && record.moment && typeof record.moment === "object"
      ? record.moment
      : typeof record.id !== "string" && record.trip && typeof record.trip === "object"
        ? record.trip
        : record;
  if (!nested || typeof nested !== "object") {
    return null;
  }
  const trip = nested as Partial<TripDetail>;
  if (typeof trip.id !== "string" || !trip.id.trim() || !trip.id.startsWith("trip_")) {
    return null;
  }
  if (heldTripIdSet.has(trip.id)) {
    return null;
  }
  return {
    ...trip,
    userId: typeof trip.userId === "string" && trip.userId ? trip.userId : "user_travelos_owner",
    summary: typeof trip.summary === "string" ? trip.summary : "",
    country: typeof trip.country === "string" ? trip.country : "",
    city: typeof trip.city === "string" ? trip.city : "",
    startDate: typeof trip.startDate === "string" ? trip.startDate : "",
    endDate: typeof trip.endDate === "string" ? trip.endDate : "",
    coverPhotoId: trip.coverPhotoId ?? null,
    visibility: trip.visibility === "public" || trip.visibility === "shared" ? trip.visibility : "private",
    rating: typeof trip.rating === "number" ? trip.rating : null,
    totalCost: trip.totalCost ?? null,
    coordinates: trip.coordinates ?? null,
    createdAt: typeof trip.createdAt === "string" ? trip.createdAt : "",
    updatedAt: typeof trip.updatedAt === "string" ? trip.updatedAt : "",
    id: trip.id,
    title: typeof trip.title === "string" ? trip.title : "",
    slug: typeof trip.slug === "string" && trip.slug.trim() ? trip.slug : trip.id.replace(/_/g, "-"),
    photos: Array.isArray(trip.photos) ? trip.photos : [],
    journalEntries: Array.isArray(trip.journalEntries) ? trip.journalEntries : [],
    places: Array.isArray(trip.places) ? trip.places : [],
    travelRoute: Array.isArray(trip.travelRoute) ? trip.travelRoute : [],
    costs: Array.isArray(trip.costs) ? trip.costs : [],
    musicTracks: Array.isArray(trip.musicTracks) ? trip.musicTracks : [],
  };
}

function preparedFromLoaded(loaded: Array<{ modifiedTime?: string; trip: TripDetail }>) {
  return prepareFamilyEditorTrips(preferLatestDriveTrips(loaded));
}

async function readDriveTripsViaApi(): Promise<TripDetail[]> {
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
  const loaded: Array<{ modifiedTime?: string; trip: TripDetail } | null> = await Promise.all(files.map(async (file) => {
    try {
      const result = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${access.token}` },
        cache: "no-store",
      });
      if (!result.ok) {
        return null;
      }
      const trip = parseDriveTripRecord(await result.json());
      if (!trip) {
        return null;
      }
      return { modifiedTime: file.modifiedTime, trip };
    } catch {
      return null;
    }
  }));
  return preparedFromLoaded(loaded.filter((item): item is { modifiedTime?: string; trip: TripDetail } => item != null));
}

export async function readDriveTrips(): Promise<TripDetail[]> {
  const bundle = await getWarehouseTripBundle();
  if (bundle) {
    const loaded = bundle.flatMap((item) => {
      const trip = parseDriveTripRecord(item.trip ?? item);
      if (!trip) {
        return [];
      }
      return [{ modifiedTime: item.modifiedTime, trip }];
    });
    if (loaded.length > 0) {
      return preparedFromLoaded(loaded);
    }
  }
  return readDriveTripsViaApi();
}

function tripFileName(tripId: string) {
  return `${prefix}${tripId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

async function writeDriveTripViaApi(payload: TripDetail) {
  const access = await connection();
  const name = tripFileName(payload.id);
  const headers = { Authorization: `Bearer ${access.token}` };
  const query = new URLSearchParams({
    q: `'${access.folderId}' in parents and trashed = false and name = '${name}'`,
    fields: "files(id,name,modifiedTime)",
    pageSize: "10",
  });
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, { headers, cache: "no-store" });
  if (!found.ok) throw new Error("尚未儲存，請再試一次。");
  const files = await found.json() as { files: DriveTripFile[] };
  const listed = files.files ?? [];
  let id = selectLatestDriveTripFiles(listed)[0]?.id;
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
  await Promise.all(duplicateDriveTripFileIds(listed, id).map((extraId) => fetch(
    `https://www.googleapis.com/drive/v3/files/${extraId}`,
    {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    },
  )));
  return payload;
}

export async function writeDriveTrip(trip: TripDetail) {
  const payload = prepareTripForWarehouse(trip);
  const name = tripFileName(payload.id);
  const viaWarehouse = await putWarehouseTrip(name, JSON.stringify(payload));
  invalidatePublicHubCache();
  if (viaWarehouse) {
    return payload;
  }
  return writeDriveTripViaApi(payload);
}
