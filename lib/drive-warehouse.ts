import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createEmptyWarehouse,
  withNormalizedContent,
  type MomentContent,
} from "@/lib/warehouse-read";
import type { GeoPoint } from "@/lib/types";

const DEFAULT_DRIVE_WAREHOUSE_URL =
  "https://script.google.com/macros/s/AKfycbyE4a9bahFmASEh6Dda_8udSlLLhnIIr70NggG5cSSAa8EB3pxxt4SoFZ96TgJLeozY/exec";
const DEFAULT_DRIVE_WAREHOUSE_TOKEN = "cCpNneNyv0_MTyPjAZMkJ3g69t0DfDE-GP84y26YGhU";

function serverEnv(name: string) {
  return (process.env[name] ?? "").trim();
}

export function getDriveWarehouseUrl() {
  return serverEnv("TRAVELOS_DRIVE_WAREHOUSE_URL") || DEFAULT_DRIVE_WAREHOUSE_URL;
}

export function getDriveWarehouseToken() {
  return serverEnv("TRAVELOS_DRIVE_WAREHOUSE_TOKEN") || DEFAULT_DRIVE_WAREHOUSE_TOKEN;
}

export const TRAVELOS_DRIVE_WAREHOUSE_URL = DEFAULT_DRIVE_WAREHOUSE_URL;
export const TRAVELOS_DRIVE_WAREHOUSE_TOKEN = DEFAULT_DRIVE_WAREHOUSE_TOKEN;

export const DRIVE_STORAGE_PREFIX = "drive:";
export const DRIVE_INDEX_NAME = "moments.json";
export const DRIVE_WAREHOUSE_FOLDER_ID = "1Sk2TqgpF6NxoNYdUKO4h8t84UA7KxChN";
export const DRIVE_UPLOAD_CHUNK_BYTES = 256 * 1024;
export const APPS_SCRIPT_PUTBINARY_MAX_BYTES = 4_500_000;
const DRIVE_RESUMABLE_INIT_URL = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable";
const DRIVE_FILE_MEDIA_URL = "https://www.googleapis.com/drive/v3/files";
const DRIVE_SESSION_TTL_MS = 60 * 60 * 1000;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

type DriveFetch = typeof fetch;

let testFetch: DriveFetch | null = null;

export class DriveWarehouseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DriveWarehouseError";
  }
}

export function setDriveWarehouseFetchForTests(fetchImpl: DriveFetch | null) {
  testFetch = fetchImpl;
}

export function isDriveWarehouseFetchOverridden() {
  return testFetch != null;
}

export function resetDriveWarehouseForTests() {
  testFetch = null;
}

export function isDriveWarehouseConfigured() {
  return Boolean(getDriveWarehouseUrl() && getDriveWarehouseToken());
}

export function driveStorageKey(fileId: string) {
  return `${DRIVE_STORAGE_PREFIX}${fileId}`;
}

export function parseDriveFileId(storageKey: string): string | null {
  if (!storageKey.startsWith(DRIVE_STORAGE_PREFIX)) {
    return null;
  }

  const id = storageKey.slice(DRIVE_STORAGE_PREFIX.length).trim();
  return id || null;
}

export function driveObjectName(pathname: string) {
  return pathname.replace(/^\/+/, "").replace(/\/+/g, "__") || "file.bin";
}

function resolveFetch(request?: DriveFetch): DriveFetch {
  if (request) {
    return request;
  }
  if (testFetch) {
    return testFetch;
  }
  if (process.env.NODE_TEST_CONTEXT) {
    throw new DriveWarehouseError("Drive warehouse live fetch is disabled in unit tests");
  }
  return fetch;
}

function warehouseUrl(params: Record<string, string>) {
  const url = new URL(getDriveWarehouseUrl());
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

async function readResponseJson(response: Response, action: string): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  const text = await response.text();
  if (!response.ok) {
    throw new DriveWarehouseError(`${action} failed: ${response.status} ${text.slice(0, 180)}`.trim());
  }
  if (!text.trim()) {
    return null;
  }
  if (contentType.includes("text/html") || text.trimStart().startsWith("<")) {
    throw new DriveWarehouseError(`${action} returned HTML instead of JSON`);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new DriveWarehouseError(
      `${action} returned invalid JSON${error instanceof Error ? `: ${error.message}` : ""}`,
    );
  }
}

async function followRedirects(
  request: DriveFetch,
  first: Response,
  originUrl: string,
  replay: { method: string; headers?: HeadersInit; body?: string },
): Promise<Response> {
  let response = first;
  let hops = 0;

  while (REDIRECT_STATUSES.has(response.status) && hops < MAX_REDIRECTS) {
    const location = response.headers.get("location");
    if (!location) {
      break;
    }
    hops += 1;
    const nextUrl = new URL(location, originUrl).toString();
    const keepBody = response.status === 307 || response.status === 308;
    response = await request(
      nextUrl,
      keepBody
        ? {
            body: replay.body,
            headers: replay.headers,
            method: replay.method,
            redirect: hops >= MAX_REDIRECTS ? "follow" : "manual",
          }
        : {
            method: "GET",
            redirect: hops >= MAX_REDIRECTS ? "follow" : "manual",
          },
    );
  }

  return response;
}

async function getJson(
  params: Record<string, string>,
  action: string,
  requestImpl?: DriveFetch,
  options: { allowNotFound?: boolean } = {},
): Promise<unknown> {
  const request = resolveFetch(requestImpl);
  const url = warehouseUrl(params);
  const first = await request(url, { cache: "no-store", method: "GET", redirect: "manual" });
  const response = await followRedirects(request, first, url.toString(), { method: "GET" });
  if (options.allowNotFound && response.status === 404) {
    return null;
  }
  return readResponseJson(response, action);
}

async function postJson(
  payload: Record<string, unknown>,
  action: string,
  requestImpl?: DriveFetch,
): Promise<unknown> {
  const request = resolveFetch(requestImpl);
  const body = JSON.stringify(payload);
  const headers = { "Content-Type": "application/json" };
  const endpoint = getDriveWarehouseUrl();
  const first = await request(endpoint, {
    body,
    headers,
    method: "POST",
    redirect: "manual",
  });
  const response = await followRedirects(request, first, endpoint, {
    body,
    headers,
    method: "POST",
  });
  return readResponseJson(response, action);
}

function parseWarehouse(raw: unknown): MomentContent {
  if (raw == null) {
    return createEmptyWarehouse();
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) {
      return createEmptyWarehouse();
    }
    return parseWarehouse(JSON.parse(trimmed) as unknown);
  }
  if (typeof raw !== "object") {
    return createEmptyWarehouse();
  }

  const record = raw as {
    jobs?: unknown;
    moments?: unknown;
    schemaVersion?: unknown;
    text?: unknown;
    updatedAt?: unknown;
  };
  if (typeof record.text === "string") {
    return parseWarehouse(record.text);
  }
  if (!Array.isArray(record.moments) && !Array.isArray(record.jobs)) {
    return createEmptyWarehouse();
  }

  return withNormalizedContent({
    jobs: Array.isArray(record.jobs) ? (record.jobs as MomentContent["jobs"]) : [],
    moments: Array.isArray(record.moments) ? (record.moments as MomentContent["moments"]) : [],
    schemaVersion: typeof record.schemaVersion === "number" ? record.schemaVersion : undefined,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : new Date().toISOString(),
  });
}

export async function getIndex(request?: DriveFetch): Promise<MomentContent> {
  const raw = await getJson(
    { op: "index", token: getDriveWarehouseToken() },
    "Drive warehouse index GET",
    request,
  );
  return parseWarehouse(raw);
}

export async function putIndex(text: string, request?: DriveFetch): Promise<{ ok: true; name: string }> {
  const raw = await postJson(
    { op: "index", text, token: getDriveWarehouseToken() },
    "Drive warehouse index POST",
    request,
  );
  const record = raw as { name?: unknown; ok?: unknown };
  if (record?.ok === false) {
    throw new DriveWarehouseError("Drive warehouse index POST was rejected");
  }
  return { ok: true, name: typeof record?.name === "string" ? record.name : DRIVE_INDEX_NAME };
}

export async function putItem(name: string, text: string, request?: DriveFetch): Promise<{ ok: true; name: string }> {
  const raw = await postJson(
    { name, op: "item", text, token: getDriveWarehouseToken() },
    "Drive warehouse item POST",
    request,
  );
  const record = raw as { name?: unknown; ok?: unknown };
  if (record?.ok === false) {
    throw new DriveWarehouseError("Drive warehouse item POST was rejected");
  }
  return { ok: true, name: typeof record?.name === "string" ? record.name : name };
}

export async function putBinary(
  input: {
    bytes: Uint8Array;
    mimeType: string;
    name: string;
  },
  request?: DriveFetch,
): Promise<{ id: string; name: string }> {
  const raw = await postJson(
    {
      base64: Buffer.from(input.bytes).toString("base64"),
      mimeType: input.mimeType,
      name: input.name,
      token: getDriveWarehouseToken(),
    },
    "Drive warehouse binary POST",
    request,
  );
  const record = raw as { id?: unknown; name?: unknown };
  if (typeof record?.id !== "string" || !record.id.trim()) {
    throw new DriveWarehouseError("Drive warehouse binary POST did not return an id");
  }
  return {
    id: record.id,
    name: typeof record.name === "string" ? record.name : input.name,
  };
}

export type DriveAccess = {
  folderId: string;
  token: string;
};

export type DriveResumableSessionPayload = {
  coordinates: GeoPoint | null;
  exp: number;
  filename: string;
  location: string;
  mimeType: string;
  momentId: string;
  name: string;
  size: number;
  takenAt: string;
};

export type DriveResumableChunkResult =
  | { incomplete: true }
  | { id: string; name: string };

function hmacSign(body: string) {
  return createHmac("sha256", getDriveWarehouseToken()).update(body).digest("base64url");
}

export function signDriveResumableSession(
  payload: Omit<DriveResumableSessionPayload, "exp">,
): string {
  const full: DriveResumableSessionPayload = {
    ...payload,
    exp: Date.now() + DRIVE_SESSION_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${body}.${hmacSign(body)}`;
}

export function verifyDriveResumableSession(token: string): DriveResumableSessionPayload {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    throw new DriveWarehouseError("Invalid video session");
  }
  const body = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = hmacSign(body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new DriveWarehouseError("Invalid video session");
  }
  let payload: DriveResumableSessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString()) as DriveResumableSessionPayload;
  } catch {
    throw new DriveWarehouseError("Invalid video session");
  }
  if (payload.exp < Date.now()) {
    throw new DriveWarehouseError("Video session expired");
  }
  if (typeof payload.location !== "string" || !payload.location.includes("googleapis.com/upload/drive")) {
    throw new DriveWarehouseError("Invalid video session");
  }
  if (typeof payload.momentId !== "string" || !payload.momentId.trim()) {
    throw new DriveWarehouseError("Invalid video session");
  }
  if (!Number.isInteger(payload.size) || payload.size <= 0) {
    throw new DriveWarehouseError("Invalid video session");
  }
  return payload;
}

export function parseDriveContentRange(header: string | null | undefined) {
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec((header ?? "").trim());
  if (!match) {
    return null;
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(total)) {
    return null;
  }
  if (start < 0 || end < start || total <= 0 || end >= total) {
    return null;
  }
  return { start, end, total };
}

function parseDriveAccess(raw: unknown): DriveAccess | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as { error?: unknown; folderId?: unknown; token?: unknown };
  if (typeof record.error === "string" || typeof record.token !== "string" || !record.token.trim()) {
    return null;
  }
  return {
    folderId:
      typeof record.folderId === "string" && record.folderId.trim()
        ? record.folderId
        : DRIVE_WAREHOUSE_FOLDER_ID,
    token: record.token,
  };
}

export async function getDriveAccess(request?: DriveFetch): Promise<DriveAccess | null> {
  const raw = await getJson(
    { op: "drive-access", token: getDriveWarehouseToken() },
    "Drive warehouse access GET",
    request,
    { allowNotFound: true },
  );
  return parseDriveAccess(raw);
}

export async function initDriveResumableUpload(
  input: {
    mimeType: string;
    name: string;
    size: number;
  },
  requestImpl?: DriveFetch,
): Promise<{ folderId: string; location: string }> {
  const access = await getDriveAccess(requestImpl);
  if (!access) {
    throw new DriveWarehouseError("Drive access is not available");
  }
  const request = resolveFetch(requestImpl);
  const init = await request(DRIVE_RESUMABLE_INIT_URL, {
    body: JSON.stringify({
      name: input.name,
      parents: [access.folderId],
    }),
    headers: {
      Authorization: `Bearer ${access.token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(input.size),
      "X-Upload-Content-Type": input.mimeType,
    },
    method: "POST",
    redirect: "manual",
  });
  if (!init.ok) {
    throw new DriveWarehouseError(`Drive resumable init failed: ${init.status}`);
  }
  const location = init.headers.get("location");
  if (!location) {
    throw new DriveWarehouseError("Drive resumable init did not return a location");
  }
  return { folderId: access.folderId, location };
}

export async function putDriveResumableChunk(
  input: {
    body: Uint8Array | Blob | Buffer;
    contentRange: string;
    location: string;
    mimeType: string;
  },
  requestImpl?: DriveFetch,
): Promise<DriveResumableChunkResult> {
  const range = parseDriveContentRange(input.contentRange);
  if (!range) {
    throw new DriveWarehouseError("Drive resumable chunk has an invalid Content-Range");
  }
  const request = resolveFetch(requestImpl);
  const uploaded = await request(input.location, {
    body: input.body as BodyInit,
    headers: {
      "Content-Range": input.contentRange,
      "Content-Type": input.mimeType,
    },
    method: "PUT",
    redirect: "manual",
  });
  if (uploaded.status === 308) {
    return { incomplete: true };
  }
  const record = (await readResponseJson(uploaded, "Drive resumable PUT")) as {
    id?: unknown;
    name?: unknown;
  };
  if (typeof record.id !== "string" || !record.id.trim()) {
    throw new DriveWarehouseError("Drive resumable PUT did not return an id");
  }
  return {
    id: record.id,
    name: typeof record.name === "string" ? record.name : "",
  };
}

async function putDriveResumable(
  input: {
    bytes: Uint8Array;
    mimeType: string;
    name: string;
  },
  requestImpl?: DriveFetch,
): Promise<{ id: string; name: string }> {
  const total = input.bytes.byteLength;
  const started = await initDriveResumableUpload(
    { mimeType: input.mimeType, name: input.name, size: total },
    requestImpl,
  );
  const chunkSize = DRIVE_UPLOAD_CHUNK_BYTES;
  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total);
    const result = await putDriveResumableChunk(
      {
        body: input.bytes.subarray(start, end),
        contentRange: `bytes ${start}-${end - 1}/${total}`,
        location: started.location,
        mimeType: input.mimeType,
      },
      requestImpl,
    );
    if ("id" in result && result.id) {
      return {
        id: result.id,
        name: result.name || input.name,
      };
    }
  }
  throw new DriveWarehouseError("Drive resumable PUT did not return an id");
}

export async function putVideoBinary(
  input: {
    bytes: Uint8Array;
    mimeType: string;
    name: string;
  },
  request?: DriveFetch,
): Promise<{ id: string; name: string }> {
  const access = await getDriveAccess(request);
  if (!access) {
    // Live Apps Script without op=drive-access can still take tiny clips on
    // the photo JSON+base64 line. A 15s iPhone .mov must not take that line.
    if (input.bytes.byteLength > APPS_SCRIPT_PUTBINARY_MAX_BYTES) {
      throw new DriveWarehouseError("Drive access is not available");
    }
    return putBinary(input, request);
  }
  return putDriveResumable(input, request);
}

export async function getDriveMedia(
  fileId: string,
  request?: DriveFetch,
): Promise<{
  base64: string;
  bytes: Uint8Array;
  id: string;
  mimeType: string | null;
  name: string;
} | null> {
  const access = await getDriveAccess(request);
  if (!access) {
    return null;
  }

  const requestImpl = resolveFetch(request);
  const response = await requestImpl(
    `${DRIVE_FILE_MEDIA_URL}/${encodeURIComponent(fileId)}?alt=media`,
    {
      cache: "no-store",
      headers: { Authorization: `Bearer ${access.token}` },
      method: "GET",
    },
  );
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new DriveWarehouseError(`Drive media GET failed: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return {
    base64: "",
    bytes,
    id: fileId,
    mimeType: response.headers.get("content-type"),
    name: fileId,
  };
}

export type DriveWarehouseFile = {
  id: string;
  mimeType: string | null;
  name: string;
};

function parseFileList(raw: unknown): DriveWarehouseFile[] {
  if (!raw || typeof raw !== "object") {
    return [];
  }
  const record = raw as { error?: unknown; files?: unknown };
  if (typeof record.error === "string") {
    throw new DriveWarehouseError(`Drive warehouse list failed: ${record.error}`);
  }
  if (!Array.isArray(record.files)) {
    return [];
  }

  const files: DriveWarehouseFile[] = [];
  for (const entry of record.files) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const file = entry as { id?: unknown; mimeType?: unknown; name?: unknown };
    if (typeof file.id !== "string" || !file.id.trim() || typeof file.name !== "string" || !file.name.trim()) {
      continue;
    }
    files.push({
      id: file.id,
      mimeType: typeof file.mimeType === "string" ? file.mimeType : null,
      name: file.name,
    });
  }
  return files;
}

export async function scanWarehouseFiles(request?: DriveFetch): Promise<DriveWarehouseFile[]> {
  const raw = await getJson(
    { op: "list", token: getDriveWarehouseToken() },
    "Drive warehouse list GET",
    request,
  );
  if (raw && typeof raw === "object" && (raw as { error?: unknown }).error === "missing id") {
    return [];
  }
  return parseFileList(raw);
}

export const DRIVE_BINARY_CONCURRENCY = 2;

type BinaryWaiter = () => void;

const binaryGate = {
  inflight: 0,
  waiters: [] as BinaryWaiter[],
};

function acquireDriveBinarySlot() {
  if (binaryGate.inflight < DRIVE_BINARY_CONCURRENCY) {
    binaryGate.inflight += 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    binaryGate.waiters.push(resolve);
  });
}

function releaseDriveBinarySlot() {
  const next = binaryGate.waiters.shift();
  if (next) {
    next();
    return;
  }
  binaryGate.inflight = Math.max(0, binaryGate.inflight - 1);
}

async function withDriveBinarySlot<T>(work: () => Promise<T>): Promise<T> {
  await acquireDriveBinarySlot();
  try {
    return await work();
  } finally {
    releaseDriveBinarySlot();
  }
}

export async function getBinary(
  fileId: string,
  request?: DriveFetch,
  options: { op?: string } = {},
): Promise<{
  base64: string;
  bytes: Uint8Array;
  id: string;
  mimeType: string | null;
  name: string;
} | null> {
  return withDriveBinarySlot(async () => {
    const params: Record<string, string> = { id: fileId, token: getDriveWarehouseToken() };
    if (options.op) {
      params.op = options.op;
    }
    const raw = await getJson(params, "Drive warehouse binary GET", request, { allowNotFound: true });
    if (raw == null) {
      return null;
    }
    const record = raw as { base64?: unknown; error?: unknown; id?: unknown; mimeType?: unknown; name?: unknown };
    if (typeof record.error === "string" || typeof record.base64 !== "string") {
      return null;
    }
    return {
      base64: record.base64,
      bytes: new Uint8Array(Buffer.from(record.base64, "base64")),
      id: typeof record.id === "string" ? record.id : fileId,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : null,
      name: typeof record.name === "string" ? record.name : fileId,
    };
  });
}
