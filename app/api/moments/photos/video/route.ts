import { afterResponse } from "@/lib/after-response";
import {
  DriveWarehouseError,
  driveObjectName,
  driveStorageKey,
  getDriveFileMeta,
  initDriveResumableUpload,
  parseDriveContentRange,
  queryDriveResumableStatus,
  safeBrowserOrigin,
  signDriveResumableSession,
  verifyDriveResumableSession,
  putDriveResumableChunk,
  DRIVE_UPLOAD_CHUNK_BYTES,
  DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES,
} from "@/lib/drive-warehouse";
import {
  addPhotoToMoment,
  isAdminPinValid,
  momentApiErrorResponse,
  rememberUploadedDisplayPhoto,
  scheduleMomentIndex,
} from "@/lib/moment-store";
import { captureFileMime, makeMomentId } from "@/lib/moments";
import type { GeoPoint, MomentPhoto } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const VIDEO_MAX_BYTES = 100_000_000;
const VIDEO_CHUNK_MAX_BYTES = DRIVE_UPLOAD_SINGLE_PUT_MAX_BYTES;
const FAMILY_UPLOAD_FAILED = "上傳失敗。";

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function failed(status = 400) {
  return Response.json({ error: FAMILY_UPLOAD_FAILED }, { status });
}

function readCoordinates(raw: unknown): GeoPoint | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const record = raw as { latitude?: unknown; longitude?: unknown };
  const latitude = Number(record.latitude);
  const longitude = Number(record.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }
  return { latitude, longitude };
}

async function finishVideoPhoto(input: {
  coordinates: GeoPoint | null;
  fileId: string;
  filename: string;
  mimeType: string;
  momentId: string;
  takenAt: string;
}): Promise<MomentPhoto> {
  const now = new Date().toISOString();
  const photo: MomentPhoto = {
    coordinates: input.coordinates,
    createdAt: now,
    id: makeMomentId("moment_photo"),
    kind: "video",
    mimeType: input.mimeType || null,
    momentId: input.momentId,
    originalFilename: input.filename,
    originalStorageKey: null,
    storageKey: driveStorageKey(input.fileId),
    takenAt: input.takenAt ? new Date(input.takenAt).toISOString() : now,
  };
  rememberUploadedDisplayPhoto(input.momentId, photo);
  afterResponse(async () => {
    try {
      const content = await addPhotoToMoment(input.momentId, photo);
      if (content) {
        scheduleMomentIndex(input.momentId);
      }
    } catch {
      // LockService index/item writes are best-effort after the binary PUT.
    }
  });
  return photo;
}

async function completeDirectVideoUpload(
  request: Request,
  body: { fileId?: unknown; session?: unknown },
) {
  const sessionToken =
    (typeof body.session === "string" ? body.session.trim() : "") ||
    request.headers.get("x-travelos-video-session")?.trim() ||
    "";
  if (!sessionToken) {
    return failed();
  }

  const session = verifyDriveResumableSession(sessionToken);
  const hintedId = typeof body.fileId === "string" ? body.fileId.trim() : "";
  const status = await queryDriveResumableStatus(session.location, session.size);
  let fileId = "id" in status ? status.id : "";

  if (!fileId && hintedId) {
    const meta = await getDriveFileMeta(hintedId);
    if (meta?.id && (meta.size === 0 || meta.size === session.size)) {
      fileId = meta.id;
    }
  }

  if (!fileId) {
    return failed(503);
  }

  const photo = await finishVideoPhoto({
    coordinates: session.coordinates,
    fileId,
    filename: session.filename,
    mimeType: session.mimeType,
    momentId: session.momentId,
    takenAt: session.takenAt,
  });
  return Response.json({ photo });
}

export async function POST(request: Request) {
  try {
    const pin = request.headers.get("x-travelos-admin-pin");
    if (!isAdminPinValid(pin)) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return failed();
    }

    let body: {
      complete?: unknown;
      coordinates?: unknown;
      fileId?: unknown;
      filename?: unknown;
      mimeType?: unknown;
      momentId?: unknown;
      session?: unknown;
      size?: unknown;
      takenAt?: unknown;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return failed();
    }

    if (body.complete === true) {
      return completeDirectVideoUpload(request, body);
    }

    const momentId = typeof body.momentId === "string" ? body.momentId.trim() : "";
    const filename = typeof body.filename === "string" ? body.filename.trim() : "";
    const size = typeof body.size === "number" ? body.size : Number(body.size);
    const takenAt = typeof body.takenAt === "string" ? body.takenAt.trim() : "";
    const mimeType =
      typeof body.mimeType === "string" && body.mimeType.trim()
        ? body.mimeType
        : captureFileMime({ name: filename, type: "" });

    if (!momentId || !filename || !Number.isInteger(size) || size <= 0 || size > VIDEO_MAX_BYTES) {
      return failed();
    }

    const objectName = driveObjectName(
      `travelos/moments/photos/${momentId}/${Date.now()}-${cleanFilename(filename)}`,
    );
    const started = await initDriveResumableUpload({
      mimeType: mimeType || "video/quicktime",
      name: objectName,
      origin: safeBrowserOrigin(request.headers.get("origin")),
      size,
    });
    const session = signDriveResumableSession({
      coordinates: readCoordinates(body.coordinates),
      filename,
      location: started.location,
      mimeType: mimeType || "video/quicktime",
      momentId,
      name: objectName,
      size,
      takenAt,
    });
    return Response.json({ session, uploadUrl: started.location });
  } catch (error) {
    if (error instanceof DriveWarehouseError) {
      return failed(503);
    }
    return momentApiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const pin = request.headers.get("x-travelos-admin-pin");
    if (!isAdminPinValid(pin)) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      return failed();
    }

    const sessionHeader = request.headers.get("x-travelos-video-session")?.trim() ?? "";
    if (!sessionHeader) {
      return failed();
    }

    const session = verifyDriveResumableSession(sessionHeader);
    const range = parseDriveContentRange(request.headers.get("content-range"));
    if (!range || range.total !== session.size) {
      return failed();
    }

    const expected = range.end - range.start + 1;
    if (expected > VIDEO_CHUNK_MAX_BYTES) {
      return failed();
    }
    if (range.end !== range.total - 1 && expected % DRIVE_UPLOAD_CHUNK_BYTES !== 0) {
      return failed();
    }

    const declared = Number(request.headers.get("content-length"));
    const canStream =
      Number.isInteger(declared) &&
      declared === expected &&
      declared <= VIDEO_CHUNK_MAX_BYTES &&
      request.body != null;
    let body: Uint8Array | ReadableStream<Uint8Array>;
    if (canStream && request.body) {
      body = request.body;
    } else {
      const chunk = new Uint8Array(await request.arrayBuffer());
      if (chunk.byteLength !== expected || chunk.byteLength > VIDEO_CHUNK_MAX_BYTES) {
        return failed();
      }
      body = chunk;
    }

    const result = await putDriveResumableChunk({
      body,
      contentRange: `bytes ${range.start}-${range.end}/${range.total}`,
      location: session.location,
      mimeType: session.mimeType,
    });

    if ("incomplete" in result) {
      return Response.json({ ok: true });
    }

    const photo = await finishVideoPhoto({
      coordinates: session.coordinates,
      fileId: result.id,
      filename: session.filename,
      mimeType: session.mimeType,
      momentId: session.momentId,
      takenAt: session.takenAt,
    });
    return Response.json({ photo });
  } catch (error) {
    if (error instanceof DriveWarehouseError) {
      return failed(503);
    }
    return momentApiErrorResponse(error);
  }
}
