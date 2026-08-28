import { momentItemBlobPath, normalizeTravelMoment } from "./moments.ts";
import type { TravelMoment } from "./types.ts";
import { MomentWarehouseUnavailableError, type WarehouseGet } from "./warehouse-read.ts";

export { momentItemBlobPath } from "./moments.ts";

export const MOMENT_ITEM_GET_OPTIONS = { access: "private", useCache: false } as const;

export const MOMENT_ITEM_PUT_OPTIONS = {
  access: "public" as const,
  addRandomSuffix: false,
  allowOverwrite: true,
  contentType: "application/json",
};

export type MomentItemRecord = {
  moment: TravelMoment;
  updatedAt: string;
};

export type MomentItemPut = (
  pathname: string,
  body: string,
  options: {
    access: "public";
    addRandomSuffix: boolean;
    allowOverwrite: boolean;
    contentType: string;
  },
) => Promise<{ pathname: string; url: string }>;

export function createMomentItemRecord(moment: TravelMoment, updatedAt = new Date().toISOString()): MomentItemRecord {
  return {
    moment: normalizeTravelMoment(moment),
    updatedAt,
  };
}

export function parseMomentItemRecord(raw: unknown): TravelMoment | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const record = raw as { moment?: TravelMoment; id?: string };
  if (record.moment && typeof record.moment.id === "string") {
    return normalizeTravelMoment(record.moment);
  }

  if (typeof record.id === "string") {
    return normalizeTravelMoment(raw as TravelMoment);
  }

  return null;
}

export function overlayMoments(indexMoments: TravelMoment[], items: TravelMoment[]) {
  const byId = new Map(indexMoments.map((moment) => [moment.id, normalizeTravelMoment(moment)]));
  for (const item of items) {
    byId.set(item.id, normalizeTravelMoment(item));
  }

  const extra = items.filter((item) => !indexMoments.some((moment) => moment.id === item.id));
  return [...extra.map((item) => byId.get(item.id) ?? item), ...indexMoments.map((moment) => byId.get(moment.id) ?? moment)];
}

export async function loadMomentItemFromBlobGet(
  getBlob: WarehouseGet,
  momentId: string,
): Promise<TravelMoment | null> {
  const result = await getBlob(momentItemBlobPath(momentId), MOMENT_ITEM_GET_OPTIONS);
  if (!result) {
    return null;
  }
  if (result.statusCode === 404 || !result.stream) {
    return null;
  }
  if (result.statusCode !== 200) {
    throw new MomentWarehouseUnavailableError(`HTTP ${result.statusCode}`);
  }

  try {
    const raw = await new Response(result.stream).json();
    return parseMomentItemRecord(raw);
  } catch (error) {
    throw new MomentWarehouseUnavailableError(error instanceof Error ? error.message : "invalid moment item JSON");
  }
}

export async function putMomentItemRecord(putBlob: MomentItemPut, moment: TravelMoment) {
  const record = createMomentItemRecord(moment);
  const pathname = momentItemBlobPath(moment.id);
  await putBlob(pathname, JSON.stringify(record, null, 2), MOMENT_ITEM_PUT_OPTIONS);
  return record;
}
