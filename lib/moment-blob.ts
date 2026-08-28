import { BlobAccessError, BlobNotFoundError, get, put } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/editable-store";
import type { MomentItemPut } from "@/lib/moment-item";
import type { WarehouseGet, WarehouseGetResult } from "@/lib/warehouse-read";

export type MomentBlobPutOptions = {
  access: "public";
  addRandomSuffix?: boolean;
  allowOverwrite?: boolean;
  cacheControlMaxAge?: number;
  contentType?: string;
};

export type MomentBlobAdapter = {
  get: WarehouseGet;
  put: (pathname: string, body: string, options: MomentBlobPutOptions) => Promise<{ pathname: string; url: string }>;
};

export type LiveMomentBlobGet = (
  pathname: string,
  options: { access: "public" | "private"; useCache?: boolean },
) => Promise<{ statusCode: number; stream: ReadableStream<Uint8Array> | null } | null>;

export type LiveMomentBlobReader = {
  fetchBlob?: typeof fetch;
  getBlob?: LiveMomentBlobGet;
  storeId?: string;
};

let testAdapter: MomentBlobAdapter | null = null;

export function setMomentBlobAdapterForTests(adapter: MomentBlobAdapter | null) {
  testAdapter = adapter;
}

export function isMomentJsonBlobConfigured() {
  return testAdapter != null || isBlobConfigured();
}

export function resolveBlobStoreId(env: NodeJS.Dict<string> = process.env) {
  const fromStore = env.BLOB_STORE_ID?.trim();
  if (fromStore) {
    return fromStore.replace(/^store_/, "");
  }

  const token = env.BLOB_READ_WRITE_TOKEN?.trim() ?? "";
  const [, , , storeId = ""] = token.split("_");
  return storeId;
}

export function publicBlobUrl(pathname: string, storeId = resolveBlobStoreId()) {
  if (!storeId) {
    return null;
  }

  return `https://${storeId}.public.blob.vercel-storage.com/${pathname}`;
}

export function shouldFallBackToPublicBlob(error: unknown) {
  if (error instanceof BlobNotFoundError || error instanceof BlobAccessError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /403|404|Forbidden|Failed to fetch blob|unable to extract store ID/i.test(error.message);
}

export async function readLiveMomentBlob(
  pathname: string,
  deps: LiveMomentBlobReader = {},
): Promise<WarehouseGetResult | null> {
  const getBlob = deps.getBlob ?? (get as LiveMomentBlobGet);
  const fetchBlob = deps.fetchBlob ?? fetch;

  try {
    const result = await getBlob(pathname, { access: "private", useCache: false });
    if (result?.statusCode === 200 && result.stream) {
      return { statusCode: result.statusCode, stream: result.stream };
    }
  } catch (error) {
    if (!shouldFallBackToPublicBlob(error)) {
      throw error;
    }
  }

  const url = publicBlobUrl(pathname, deps.storeId ?? resolveBlobStoreId());
  if (!url) {
    return null;
  }

  const response = await fetchBlob(url, { cache: "no-store" });
  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch blob: ${response.status} ${response.statusText}`.trim());
  }

  if (!response.body) {
    return null;
  }

  return { statusCode: 200, stream: response.body };
}

export async function getMomentJsonBlob(
  pathname: string,
  options: { access: "public" | "private"; useCache?: boolean },
): Promise<WarehouseGetResult | null> {
  if (testAdapter) {
    return testAdapter.get(pathname, options);
  }

  try {
    return await readLiveMomentBlob(pathname);
  } catch (error) {
    if (error instanceof BlobNotFoundError) {
      return null;
    }
    throw error;
  }
}

export async function putMomentJsonBlob(pathname: string, body: string, options: MomentBlobPutOptions) {
  if (testAdapter) {
    return testAdapter.put(pathname, body, options);
  }

  const blob = await put(pathname, body, options);
  return { pathname: blob.pathname, url: blob.url };
}

export const putMomentItemJson: MomentItemPut = (pathname, body, options) => {
  return putMomentJsonBlob(pathname, body, options);
};
