import { getDriveAccess, getWarehouseTripBundle, putWarehouseTrip } from "@/lib/drive-warehouse";
import { invalidatePublicHubCache } from "@/lib/public-hub";
import { VANITY_CREW_HELD_TRIP_IDS, prepareFamilyEditorTrips, prepareTripForWarehouse } from "@/lib/trip-series";
import type { TripDetail } from "@/lib/types";
import { withDriveReadBudget } from "@/lib/drive-read-budget";
import { patchEditorTripCatalog } from "@/lib/editor-trip-catalog";
import { afterResponse } from "@/lib/after-response";

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

async function readDriveTripsViaApi(request?: typeof fetch): Promise<TripDetail[]> {
  const access = await getDriveAccess(request);
  if (!access) throw new Error("家庭儲存暫時無法連接，請稍後再試。");
  const read = request ?? fetch;
  const headers = { Authorization: `Bearer ${access.token}` };
  const allFiles: DriveTripFile[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({
      q: `'${access.folderId}' in parents and trashed = false and name contains '${prefix}'`,
      fields: "nextPageToken,files(id,name,modifiedTime)", pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await read(`https://www.googleapis.com/drive/v3/files?${query}`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error("無法讀取家庭遊記。");
    const listing = await response.json() as { files?: DriveTripFile[]; nextPageToken?: string };
    allFiles.push(...(listing.files ?? []));
    pageToken = listing.nextPageToken ?? "";
  } while (pageToken);
  const loaded = await Promise.all(selectDriveTripFilesForRead(allFiles).map(async file => {
    const result = await read(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, { headers, cache: "no-store" });
    if (!result.ok) throw new Error("部分遊記暫時無法讀取，請稍後再試。");
    const trip = parseDriveTripRecord(await result.json());
    if (!trip) throw new Error("遊記資料未完整讀取，請稍後再試。");
    return { modifiedTime: file.modifiedTime, trip };
  }));
  return preparedFromLoaded(loaded);
}

export async function readDriveTrips(request?: typeof fetch): Promise<TripDetail[]> {
  try {
    return await readDriveTripsViaApi(request);
  } catch (directError) {
    const bundle = await getWarehouseTripBundle(request);
    if (!bundle) throw directError;
    const loaded = bundle.map(item => {
      const trip = parseDriveTripRecord(item.trip ?? item);
      if (!trip) throw directError;
      return { modifiedTime: item.modifiedTime, trip };
    });
    return preparedFromLoaded(loaded);
  }
}
function tripFileName(tripId: string) {
  return `${prefix}${tripId.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
}

/** Read one authoritative trip without fetching the editor's complete library.
 * Only an absent file is null; a failed read must not trigger a seed fallback.
 */
export async function readDriveTrip(tripId: string, request?: typeof fetch, timeoutMs?: number): Promise<TripDetail | null> {
  if (!/^trip_[a-zA-Z0-9_-]+$/.test(tripId) || heldTripIdSet.has(tripId)) return null;
  return withDriveReadBudget(request, (read) => readDriveTripWithinBudget(tripId, read), timeoutMs);
}

async function readDriveTripWithinBudget(tripId: string, request: typeof fetch): Promise<TripDetail | null> {
  const access = await getDriveAccess(request);
  if (!access) throw new Error("家庭儲存暫時無法連接，請稍後再試。");
  const read = request ?? fetch;
  const name = tripFileName(tripId);
  const headers = { Authorization: `Bearer ${access.token}` };
  const files: DriveTripFile[] = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({
      q: `'${access.folderId}' in parents and trashed = false and name = '${name}'`,
      fields: "nextPageToken,files(id,name,modifiedTime)",
      pageSize: "1000",
      ...(pageToken ? { pageToken } : {}),
    });
    const response = await read(`https://www.googleapis.com/drive/v3/files?${query}`, { headers, cache: "no-store" });
    if (!response.ok) throw new Error("無法讀取這篇家庭遊記。");
    const listing = await response.json() as { files?: DriveTripFile[]; nextPageToken?: string };
    files.push(...(listing.files ?? []).filter((file) => file.name === name));
    pageToken = listing.nextPageToken ?? "";
  } while (pageToken);
  const file = selectLatestDriveTripFiles(files)[0];
  if (!file) return null;
  const response = await read(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?alt=media`, {
    headers, cache: "no-store",
  });
  if (!response.ok) throw new Error("無法讀取這篇家庭遊記。");
  const trip = parseDriveTripRecord(await response.json());
  if (!trip || trip.id !== tripId) throw new Error("家庭遊記資料不一致，請稍後再試。");
  return prepareFamilyEditorTrips([trip])[0] ?? null;
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

export async function saveDriveTripWithCatalog(trip: TripDetail): Promise<{ trip: TripDetail; warning?: string }> {
  const payload = prepareTripForWarehouse(trip);
  const name = tripFileName(payload.id);
  const viaWarehouse = await putWarehouseTrip(name, JSON.stringify(payload));
  invalidatePublicHubCache();
  const saved = viaWarehouse ? payload : await writeDriveTripViaApi(payload);
  try {
    await patchEditorTripCatalog([saved]);
    return { trip: saved };
  } catch {
    afterResponse(async () => {
      try { await patchEditorTripCatalog([saved]); } catch { /* Saved trip remains authoritative; one bounded repair attempt only. */ }
    });
    return { trip: saved, warning: "遊記已儲存；目錄更新稍有延遲，稍後重新整理即可。" };
  }
}

export async function writeDriveTrip(trip: TripDetail) {
  return (await saveDriveTripWithCatalog(trip)).trip;
}
