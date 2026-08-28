import { BlobAccessError, BlobNotFoundError, del, get, head, list, put } from "@vercel/blob";
import { isBlobConfigured } from "@/lib/editable-store";
import type { MomentItemPut } from "@/lib/moment-item";
import type { WarehouseGet, WarehouseGetResult } from "@/lib/warehouse-read";

export type BlobStoreAccess = "private" | "public";

export type MomentBlobPutOptions = {
  access: BlobStoreAccess;
  addRandomSuffix?: boolean;
  allowOverwrite?: boolean;
  cacheControlMaxAge?: number;
  contentType?: string;
};

export type MomentBlobAdapter = {
  get: WarehouseGet;
  put: (pathname: string, body: string, options: MomentBlobPutOptions) => Promise<{ pathname: string; url: string }>;
};

export type LiveMomentBlobGetResult = {
  statusCode: number;
  stream: ReadableStream<Uint8Array> | null;
  contentType?: string | null;
  blob?: { contentType?: string | null };
};

export type LiveMomentBlobGet = (
  pathname: string,
  options: { access: BlobStoreAccess; useCache?: boolean },
) => Promise<LiveMomentBlobGetResult | null>;

export type LiveMomentBlobHead = (pathname: string) => Promise<{ url: string } | null>;

export type LiveMomentBlobPut = (
  pathname: string,
  body: string | Blob,
  options: MomentBlobPutOptions,
) => Promise<{ pathname: string; url: string }>;

export type LiveMomentBlobReader = {
  fetchBlob?: typeof fetch;
  getBlob?: LiveMomentBlobGet;
  headBlob?: LiveMomentBlobHead;
  storeId?: string;
};

let testAdapter: MomentBlobAdapter | null = null;
let rememberedAccess: BlobStoreAccess | null = null;

export function setMomentBlobAdapterForTests(adapter: MomentBlobAdapter | null) {
  testAdapter = adapter;
  rememberedAccess = null;
}

export function resetBlobStoreAccessForTests() {
  rememberedAccess = null;
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

export function privateBlobUrlFrom(urlOrPathname: string, storeId = resolveBlobStoreId()) {
  if (urlOrPathname.startsWith("http://") || urlOrPathname.startsWith("https://")) {
    return urlOrPathname.replace(".public.blob.vercel-storage.com", ".private.blob.vercel-storage.com");
  }

  if (!storeId) {
    return null;
  }

  return `https://${storeId}.private.blob.vercel-storage.com/${urlOrPathname}`;
}

export function shouldFallBackToPublicBlob(error: unknown) {
  if (error instanceof BlobNotFoundError || error instanceof BlobAccessError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /403|404|Forbidden|Failed to fetch blob|unable to extract store ID|Access denied/i.test(error.message);
}

function shouldTryNextPutAccess(error: unknown) {
  if (error instanceof BlobAccessError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /access|forbidden|private|public|Access denied|Failed to fetch blob/i.test(error.message);
}

export const MOMENT_BLOB_PRIVATE_GET_OPTIONS = { access: "private", useCache: false } as const;

function contentTypeFromGet(result: LiveMomentBlobGetResult) {
  return result.contentType ?? result.blob?.contentType ?? null;
}

async function getWithAccess(
  urlOrPathname: string,
  access: BlobStoreAccess,
  getBlob: LiveMomentBlobGet,
): Promise<(WarehouseGetResult & { contentType?: string | null }) | null> {
  const result = await getBlob(
    urlOrPathname,
    access === "private" ? MOMENT_BLOB_PRIVATE_GET_OPTIONS : { access, useCache: false },
  );
  if (result?.statusCode === 200 && result.stream) {
    rememberedAccess = access;
    return { statusCode: 200, stream: result.stream, contentType: contentTypeFromGet(result) };
  }
  return null;
}

async function tryGet(
  urlOrPathname: string,
  access: BlobStoreAccess,
  getBlob: LiveMomentBlobGet,
) {
  try {
    return await getWithAccess(urlOrPathname, access, getBlob);
  } catch (error) {
    if (!shouldFallBackToPublicBlob(error)) {
      throw error;
    }
    return null;
  }
}

export async function readLiveMomentBlob(
  pathname: string,
  deps: LiveMomentBlobReader = {},
): Promise<(WarehouseGetResult & { contentType?: string | null }) | null> {
  const getBlob = deps.getBlob ?? (get as LiveMomentBlobGet);
  const fetchBlob = deps.fetchBlob ?? fetch;
  const headBlob =
    deps.headBlob ??
    (async (target: string) => {
      try {
        return await head(target);
      } catch (error) {
        if (error instanceof BlobNotFoundError || shouldFallBackToPublicBlob(error)) {
          return null;
        }
        throw error;
      }
    });
  const storeId = deps.storeId ?? resolveBlobStoreId();
  const preferred = rememberedAccess ?? "private";
  const order: BlobStoreAccess[] = preferred === "public" ? ["public", "private"] : ["private", "public"];

  for (const access of order) {
    const loaded = await tryGet(pathname, access, getBlob);
    if (loaded) {
      return loaded;
    }
  }

  let locatedUrl: string | null = null;
  try {
    const meta = await headBlob(pathname);
    locatedUrl = meta?.url ?? null;
  } catch (error) {
    if (!shouldFallBackToPublicBlob(error)) {
      throw error;
    }
  }

  if (locatedUrl) {
    const privateUrl = privateBlobUrlFrom(locatedUrl, storeId);
    if (privateUrl && privateUrl !== pathname) {
      const rewritten = await tryGet(privateUrl, "private", getBlob);
      if (rewritten) {
        return rewritten;
      }
    }
  }

  const url = locatedUrl ?? publicBlobUrl(pathname, storeId);
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

  rememberedAccess = "public";
  return { statusCode: 200, stream: response.body, contentType: response.headers.get("content-type") };
}

export async function readMomentBlobBytes(urlOrPathname: string): Promise<{
  bytes: Uint8Array;
  contentType: string | null;
} | null> {
  if (urlOrPathname.startsWith("data:")) {
    const match = /^data:([^,;]+)?(?:;base64)?,([\s\S]*)$/.exec(urlOrPathname);
    if (!match) {
      return null;
    }
    const contentType = match[1] || "application/octet-stream";
    const bytes = Buffer.from(match[2] ?? "", match[0].includes(";base64,") ? "base64" : "utf8");
    return { bytes: new Uint8Array(bytes), contentType };
  }

  const result = await readLiveMomentBlob(urlOrPathname);
  if (!result?.stream) {
    return null;
  }

  const bytes = new Uint8Array(await new Response(result.stream).arrayBuffer());
  return { bytes, contentType: result.contentType ?? null };
}

export async function getMomentJsonBlob(
  pathname: string,
  options: { access: BlobStoreAccess; useCache?: boolean },
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

export async function putWithStoreAccess(
  pathname: string,
  body: string | Blob,
  options: Omit<MomentBlobPutOptions, "access"> & { access?: BlobStoreAccess },
  putBlob: LiveMomentBlobPut = put as LiveMomentBlobPut,
) {
  const preferred = rememberedAccess ?? options.access ?? "private";
  const order: BlobStoreAccess[] = preferred === "public" ? ["public", "private"] : ["private", "public"];
  let lastError: unknown;

  for (const access of order) {
    try {
      const blob = await putBlob(pathname, body, { ...options, access });
      rememberedAccess = access;
      return { pathname: blob.pathname ?? pathname, url: blob.url };
    } catch (error) {
      lastError = error;
      if (!shouldTryNextPutAccess(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Blob put failed");
}

export async function putMomentJsonBlob(pathname: string, body: string, options: MomentBlobPutOptions) {
  if (testAdapter) {
    return testAdapter.put(pathname, body, options);
  }

  return putWithStoreAccess(pathname, body, options);
}

export const putMomentItemJson: MomentItemPut = (pathname, body, options) => {
  return putMomentJsonBlob(pathname, body, options);
};

const WAREHOUSE_PATH = "travelos/moments.json";
const BLOB_HEALTH_PATH = "travelos/moments/_health.json";

export type BlobProbe = {
  error: string | null;
  host: string | null;
  ok: boolean;
  storeAccess: BlobStoreAccess | null;
};

export type BlobStoreInspect = {
  configured: boolean;
  getPrivate: BlobProbe;
  getPublic: BlobProbe;
  hasOidc: boolean;
  hasReadWriteToken: boolean;
  hasStoreId: boolean;
  head: BlobProbe;
  list: { count: number; error: string | null; hosts: string[]; ok: boolean };
  putPrivate: BlobProbe | null;
  putPublic: BlobProbe | null;
  storeId: string | null;
};

function errorText(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 180) : "unknown";
}

export function storeAccessFromUrl(url: string | null | undefined): BlobStoreAccess | null {
  if (!url) {
    return null;
  }
  try {
    const host = new URL(url).hostname;
    if (host.includes(".private.blob.")) {
      return "private";
    }
    if (host.includes(".public.blob.")) {
      return "public";
    }
  } catch {
    return null;
  }
  return null;
}

function hostFromUrl(url: string | null | undefined) {
  try {
    return url ? new URL(url).hostname : null;
  } catch {
    return null;
  }
}

function probeFromUrl(url: string | null | undefined, error: string | null = null): BlobProbe {
  return {
    error,
    host: hostFromUrl(url),
    ok: Boolean(url) && !error,
    storeAccess: storeAccessFromUrl(url),
  };
}

async function probeGet(access: BlobStoreAccess): Promise<BlobProbe> {
  try {
    const result = await get(WAREHOUSE_PATH, { access, useCache: false });
    if (result?.statusCode === 200 && result.stream) {
      return { error: null, host: null, ok: true, storeAccess: access };
    }
    return { error: result ? `HTTP ${result.statusCode}` : "missing", host: null, ok: false, storeAccess: access };
  } catch (error) {
    return { error: errorText(error), host: null, ok: false, storeAccess: access };
  }
}

async function probePut(access: BlobStoreAccess): Promise<BlobProbe> {
  try {
    const blob = await put(BLOB_HEALTH_PATH, `{"ok":true,"access":"${access}"}`, {
      access,
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
    });
    return probeFromUrl(blob.url);
  } catch (error) {
    return { error: errorText(error), host: null, ok: false, storeAccess: access };
  }
}

export async function inspectBlobStore(options: { includePut?: boolean } = {}): Promise<BlobStoreInspect> {
  const inspect: BlobStoreInspect = {
    configured: isMomentJsonBlobConfigured(),
    getPrivate: { error: null, host: null, ok: false, storeAccess: "private" },
    getPublic: { error: null, host: null, ok: false, storeAccess: "public" },
    hasOidc: Boolean(process.env.VERCEL_OIDC_TOKEN?.trim()),
    hasReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    hasStoreId: Boolean(process.env.BLOB_STORE_ID?.trim()),
    head: { error: null, host: null, ok: false, storeAccess: null },
    list: { count: 0, error: null, hosts: [], ok: false },
    putPrivate: null,
    putPublic: null,
    storeId: resolveBlobStoreId() || null,
  };

  try {
    const listed = await list({ limit: 8, prefix: "travelos/moments" });
    const hosts = [
      ...new Set(listed.blobs.map((blob) => hostFromUrl(blob.url)).filter((host): host is string => Boolean(host))),
    ];
    inspect.list = { count: listed.blobs.length, error: null, hosts, ok: true };
  } catch (error) {
    inspect.list = { count: 0, error: errorText(error), hosts: [], ok: false };
  }

  try {
    const meta = await head(WAREHOUSE_PATH);
    inspect.head = probeFromUrl(meta.url);
  } catch (error) {
    inspect.head = { error: errorText(error), host: null, ok: false, storeAccess: null };
  }

  inspect.getPrivate = await probeGet("private");
  inspect.getPublic = await probeGet("public");

  if (options.includePut) {
    inspect.putPrivate = await probePut("private");
    inspect.putPublic = await probePut("public");
    try {
      await del(BLOB_HEALTH_PATH);
    } catch {
      // Health put is a probe only. Leaving the tiny file is fine.
    }
  }

  return inspect;
}
