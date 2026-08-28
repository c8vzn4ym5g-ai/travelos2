import { MOMENT_ITEM_PREFIX, momentItemBlobPath, normalizeTravelMoment } from "./moments.ts";
import type { TravelMoment } from "./types.ts";
import { MomentWarehouseUnavailableError, type WarehouseGet, type WarehouseGetResult } from "./warehouse-read.ts";

export { momentItemBlobPath } from "./moments.ts";

export const MOMENT_ITEM_GET_OPTIONS = { access: "private", useCache: false } as const;

export const MOMENT_ITEM_PUT_OPTIONS = {
  access: "private" as const,
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
    access: "private" | "public";
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

export function momentIdFromItemBlobPath(pathname: string): string | null {
  const prefix = `${MOMENT_ITEM_PREFIX}/`;
  if (!pathname.startsWith(prefix) || !pathname.endsWith(".json")) {
    return null;
  }

  const id = pathname.slice(prefix.length, -".json".length);
  return id || null;
}

export function skeletonMomentFromItemPath(pathname: string): TravelMoment | null {
  const id = momentIdFromItemBlobPath(pathname);
  if (!id) {
    return null;
  }

  const createdAt = new Date(0).toISOString();
  return normalizeTravelMoment({
    command: null,
    coordinates: null,
    createdAt,
    draft: "",
    food: [],
    id,
    note: "",
    originalAudioUrl: null,
    people: [],
    photos: [],
    place: [],
    scenery: [],
    time: createdAt,
    topics: [],
    transcript: null,
    tripId: null,
  });
}

export async function momentsFromListedItemBlobs(
  listed: Array<{ pathname: string; url: string }>,
  readUrl: (url: string) => Promise<WarehouseGetResult | null>,
): Promise<TravelMoment[]> {
  const loaded = await Promise.all(
    listed.map(async (entry) => {
      if (!entry.pathname.endsWith(".json")) {
        return null;
      }

      try {
        const result = await readUrl(entry.url);
        if (result?.statusCode === 200 && result.stream) {
          const raw = await new Response(result.stream).json();
          const parsed = parseMomentItemRecord(raw);
          if (parsed) {
            return parsed;
          }
        }
      } catch {
        // Item bodies can 403 on the public CDN. The pathname id is still enough for GET.
      }

      return skeletonMomentFromItemPath(entry.pathname);
    }),
  );

  return loaded.filter((item): item is TravelMoment => item != null);
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
    return null;
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
