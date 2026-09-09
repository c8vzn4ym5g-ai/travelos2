import { getDriveAccess } from "@/lib/drive-warehouse";
import type { TripDetail } from "@/lib/types";

const prefix = "travelos__trip__";

async function connection() {
  const access = await getDriveAccess();
  if (!access) throw new Error("家庭儲存暫時無法連接，變更尚未儲存。");
  return access;
}

export async function readDriveTrips(): Promise<TripDetail[]> {
  const access = await connection();
  const query = new URLSearchParams({ q: `'${access.folderId}' in parents and trashed = false and name contains '${prefix}'`, fields: "files(id,name)", pageSize: "1000" });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, { headers: { Authorization: `Bearer ${access.token}` }, cache: "no-store" });
  if (!response.ok) throw new Error("無法讀取家庭遊記。");
  const listing = await response.json() as { files: Array<{ id: string; name: string }> };
  return Promise.all(listing.files.filter(file => file.name.startsWith(prefix) && file.name.endsWith(".json")).map(async file => {
    const result = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, { headers: { Authorization: `Bearer ${access.token}` }, cache: "no-store" });
    if (!result.ok) throw new Error("無法讀取家庭遊記。");
    return result.json() as Promise<TripDetail>;
  }));
}

export async function writeDriveTrip(trip: TripDetail) {
  const access = await connection();
  const name = `${prefix}${trip.id.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`;
  const headers = { Authorization: `Bearer ${access.token}` };
  const query = new URLSearchParams({ q: `'${access.folderId}' in parents and trashed = false and name = '${name}'`, fields: "files(id)", pageSize: "10" });
  const found = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, { headers, cache: "no-store" });
  if (!found.ok) throw new Error("尚未儲存，請再試一次。");
  const files = await found.json() as { files: Array<{ id: string }> };
  let id = files.files[0]?.id;
  if (!id) {
    const created = await fetch("https://www.googleapis.com/drive/v3/files", { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ name, parents: [access.folderId], mimeType: "application/json" }) });
    if (!created.ok) throw new Error("尚未儲存，請再試一次。");
    id = (await created.json() as { id: string }).id;
  }
  const saved = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${id}?uploadType=media`, { method: "PATCH", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(trip) });
  if (!saved.ok) throw new Error("尚未儲存，請再試一次。");
  return trip;
}
