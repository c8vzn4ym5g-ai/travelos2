import { BlobNotFoundError, get, put } from "@vercel/blob";
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

let testAdapter: MomentBlobAdapter | null = null;

export function setMomentBlobAdapterForTests(adapter: MomentBlobAdapter | null) {
  testAdapter = adapter;
}

export function isMomentJsonBlobConfigured() {
  return testAdapter != null || isBlobConfigured();
}

export async function getMomentJsonBlob(
  pathname: string,
  options: { access: "public" | "private"; useCache?: boolean },
): Promise<WarehouseGetResult | null> {
  if (testAdapter) {
    return testAdapter.get(pathname, options);
  }

  try {
    const result = await get(pathname, options);
    if (!result) {
      return null;
    }
    return { statusCode: result.statusCode, stream: result.stream };
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
