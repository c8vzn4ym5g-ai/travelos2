import {
  MOMENTS_BLOB_PATH,
  MOMENTS_SCHEMA_VERSION,
  normalizeTravelJob,
  normalizeTravelMoment,
} from "./moments.ts";
import type { TravelJob, TravelMoment } from "./types.ts";

export { MOMENTS_BLOB_PATH };

export type MomentContent = {
  jobs: TravelJob[];
  moments: TravelMoment[];
  schemaVersion?: number;
  updatedAt: string;
};

export class MomentWarehouseUnavailableError extends Error {
  readonly status = 503 as const;

  constructor(detail?: string) {
    super(detail ? `Could not read the moment warehouse. ${detail}` : "Could not read the moment warehouse.");
    this.name = "MomentWarehouseUnavailableError";
  }
}

export const WAREHOUSE_GET_OPTIONS = { access: "public", useCache: false } as const;

export type WarehouseGetResult = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
};

export type WarehouseGet = (
  pathname: string,
  options: { access: "public" | "private"; useCache?: boolean },
) => Promise<WarehouseGetResult | null>;

export function createEmptyWarehouse(): MomentContent {
  return {
    jobs: [],
    moments: [],
    schemaVersion: MOMENTS_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
}

export function withNormalizedContent(content: MomentContent): MomentContent {
  return {
    jobs: (content.jobs ?? []).map(normalizeTravelJob),
    moments: (content.moments ?? []).map(normalizeTravelMoment),
    schemaVersion: content.schemaVersion ?? MOMENTS_SCHEMA_VERSION,
    updatedAt: content.updatedAt,
  };
}

export async function loadWarehouseFromBlobGet(getWarehouse: WarehouseGet): Promise<{
  content: MomentContent;
  createdEmpty: boolean;
}> {
  const readOnce = async () => {
    const result = await getWarehouse(MOMENTS_BLOB_PATH, WAREHOUSE_GET_OPTIONS);
    if (!result) {
      return { content: createEmptyWarehouse(), createdEmpty: true };
    }
    if (result.statusCode !== 200 || !result.stream) {
      throw new MomentWarehouseUnavailableError(`HTTP ${result.statusCode}`);
    }

    try {
      const raw = (await new Response(result.stream).json()) as MomentContent;
      return { content: withNormalizedContent(raw), createdEmpty: false };
    } catch (error) {
      throw new MomentWarehouseUnavailableError(error instanceof Error ? error.message : "invalid warehouse JSON");
    }
  };

  try {
    return await readOnce();
  } catch {
    try {
      return await readOnce();
    } catch (retryError) {
      if (retryError instanceof MomentWarehouseUnavailableError) {
        throw retryError;
      }
      throw new MomentWarehouseUnavailableError(retryError instanceof Error ? retryError.message : "blob get failed");
    }
  }
}
