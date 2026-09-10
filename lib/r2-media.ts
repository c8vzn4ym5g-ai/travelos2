import { getCloudflareContext } from "@opennextjs/cloudflare";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@/lib/site-url";

export const TRAVELOS_MEDIA_BINDING = "TRAVELOS_MEDIA";
export const TRAVELOS_MEDIA_BUCKET = "travelos-media";
export const TRAVELOS_MEDIA_PROBE_KEY = "probe/ok.txt";
export const TRAVELOS_MEDIA_PROBE_BODY = "travelos-media ok\n";

export type TravelosMediaObject = {
  body: ReadableStream<Uint8Array> | null;
  httpMetadata?: { contentType?: string };
  size?: number;
};

export type TravelosMediaBucket = {
  get: (key: string) => Promise<TravelosMediaObject | null>;
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView | string | Blob | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
};

const KEY_RE = /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,198}$/;

export function isTravelosMediaKey(key: string) {
  return KEY_RE.test(key) && !key.includes("..") && !key.endsWith("/");
}

export function travelosMediaUrl(key: string, origin = DEFAULT_PUBLIC_SITE_ORIGIN) {
  const base = origin.replace(/\/$/, "");
  return `${base}/api/media?key=${encodeURIComponent(key)}`;
}

export async function getTravelosMediaBucket(): Promise<TravelosMediaBucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as { TRAVELOS_MEDIA?: TravelosMediaBucket }).TRAVELOS_MEDIA;
    if (!bucket || typeof bucket.get !== "function" || typeof bucket.put !== "function") {
      return null;
    }
    return bucket;
  } catch {
    return null;
  }
}

export async function putTravelosMediaObject(
  key: string,
  body: ArrayBuffer | ArrayBufferView | string | Blob,
  contentType = "application/octet-stream",
) {
  if (!isTravelosMediaKey(key)) {
    throw new Error("Invalid R2 object key.");
  }
  const bucket = await getTravelosMediaBucket();
  if (!bucket) {
    throw new Error("R2 travelos-media is not bound on this Worker.");
  }
  await bucket.put(key, body, { httpMetadata: { contentType } });
  return { key, url: travelosMediaUrl(key), contentType };
}

export async function getTravelosMediaObject(key: string) {
  if (!isTravelosMediaKey(key)) {
    return null;
  }
  const bucket = await getTravelosMediaBucket();
  if (!bucket) {
    return null;
  }
  return bucket.get(key);
}

export async function putTravelosMediaProbe() {
  return putTravelosMediaObject(TRAVELOS_MEDIA_PROBE_KEY, TRAVELOS_MEDIA_PROBE_BODY, "text/plain; charset=utf-8");
}
