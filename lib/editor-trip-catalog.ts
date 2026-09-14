import { getWarehouseEditorCatalog, putWarehouseEditorCatalog } from "@/lib/drive-warehouse";
import type { TripDetail } from "@/lib/types";

export type EditorTripCatalogEntry = Pick<TripDetail, "id" | "title" | "startDate" | "endDate" | "updatedAt"> & { slug?: string };

export function editorTripCatalogEntry(trip: EditorTripCatalogEntry): EditorTripCatalogEntry {
  if (!trip?.id || !trip.title) throw new Error("遊記目錄資料不完整。");
  return { id: trip.id, title: trip.title, startDate: trip.startDate ?? "", endDate: trip.endDate ?? "", updatedAt: trip.updatedAt ?? "", ...(trip.slug ? { slug: trip.slug } : {}) };
}

export async function readEditorTripCatalog(request?: typeof fetch): Promise<EditorTripCatalogEntry[]> {
  const raw = await getWarehouseEditorCatalog(request) as { trips?: EditorTripCatalogEntry[]; error?: string };
  if (!raw || raw.error || !Array.isArray(raw.trips)) throw new Error("遊記目錄暫時無法讀取，請再試一次。");
  return raw.trips.map(editorTripCatalogEntry);
}

export async function patchEditorTripCatalog(trips: EditorTripCatalogEntry[], request?: typeof fetch) {
  const result = await putWarehouseEditorCatalog(trips.map(editorTripCatalogEntry), request) as { ok?: boolean; error?: string };
  if (!result || result.ok !== true || result.error) throw new Error("遊記已儲存，但目錄尚未更新，請重新整理後再試。");
}
