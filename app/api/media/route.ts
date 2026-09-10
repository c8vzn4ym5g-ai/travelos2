import { isAdminPinValid } from "@/lib/family-pin";
import {
  getTravelosMediaBucket,
  getTravelosMediaObject,
  isTravelosMediaKey,
  putTravelosMediaObject,
  putTravelosMediaProbe,
  TRAVELOS_MEDIA_BINDING,
  TRAVELOS_MEDIA_BUCKET,
  TRAVELOS_MEDIA_PROBE_KEY,
  travelosMediaUrl,
} from "@/lib/r2-media";

export const runtime = "nodejs";

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") ?? "";
  if (!key) {
    const bucket = await getTravelosMediaBucket();
    return Response.json({
      configured: Boolean(bucket),
      binding: TRAVELOS_MEDIA_BINDING,
      bucket: TRAVELOS_MEDIA_BUCKET,
      probeKey: TRAVELOS_MEDIA_PROBE_KEY,
      probeUrl: travelosMediaUrl(TRAVELOS_MEDIA_PROBE_KEY, url.origin),
    });
  }

  if (!isTravelosMediaKey(key)) {
    return Response.json({ error: "Invalid key" }, { status: 400 });
  }

  const object = await getTravelosMediaObject(key);
  if (!object?.body) {
    const bucket = await getTravelosMediaBucket();
    return Response.json(
      { error: bucket ? "Not found" : "R2 travelos-media is not bound on this Worker." },
      { status: bucket ? 404 : 503 },
    );
  }

  const headers = new Headers({
    "Cache-Control": "public, max-age=3600",
    "Content-Type": object.httpMetadata?.contentType || "application/octet-stream",
  });
  if (typeof object.size === "number") {
    headers.set("Content-Length", String(object.size));
  }
  return new Response(object.body, { status: 200, headers });
}

/** Probe write, or a PIN-gated upload of one object. Does not touch trip shelves. */
export async function PUT(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("probe") === "1") {
    try {
      const stored = await putTravelosMediaProbe();
      return Response.json({ ok: true, ...stored });
    } catch (error) {
      const message = error instanceof Error ? error.message : "R2 probe write failed.";
      return Response.json({ error: message }, { status: 503 });
    }
  }

  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const key = url.searchParams.get("key") ?? "";
  if (!isTravelosMediaKey(key)) {
    return Response.json({ error: "Invalid key" }, { status: 400 });
  }
  const contentType = request.headers.get("content-type") || "application/octet-stream";
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) {
    return Response.json({ error: "Empty body" }, { status: 400 });
  }
  if (bytes.byteLength > 8 * 1024 * 1024) {
    return Response.json({ error: "Object too large" }, { status: 413 });
  }

  try {
    const stored = await putTravelosMediaObject(key, bytes, contentType);
    return Response.json({ ok: true, ...stored, bytes: bytes.byteLength });
  } catch (error) {
    const message = error instanceof Error ? error.message : "R2 write failed.";
    return Response.json({ error: message }, { status: 503 });
  }
}
