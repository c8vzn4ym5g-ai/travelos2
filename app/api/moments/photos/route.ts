import { isUploadBlob, uploadFilename } from "@/lib/form-upload";
import { readMomentBlobBytes, readMomentThumbBytes } from "@/lib/moment-blob";
import {
  addPhotoToMoment,
  isAdminPinValid,
  momentApiErrorResponse,
  removePhotoFromMoment,
  resolveMomentPhoto,
  scheduleMomentIndex,
  setPhotoOriginal,
  storeMomentBinary,
} from "@/lib/moment-store";
import { makeMomentId } from "@/lib/moments";
import type { GeoPoint, MomentPhoto } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function parseCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readCoordinates(formData: FormData): GeoPoint | null {
  const latitude = parseCoordinate(String(formData.get("latitude") ?? ""));
  const longitude = parseCoordinate(String(formData.get("longitude") ?? ""));
  if (latitude === null || longitude === null) {
    return null;
  }

  return { latitude, longitude };
}

export async function GET(request: Request) {
  try {
    const pin = request.headers.get("x-travelos-admin-pin");
    if (!isAdminPinValid(pin)) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const url = new URL(request.url);
    const momentId = url.searchParams.get("momentId")?.trim() ?? "";
    const photoId = url.searchParams.get("photoId")?.trim() ?? "";
    const variant = url.searchParams.get("variant")?.trim() === "thumb" ? "thumb" : "display";
    if (!momentId || !photoId) {
      return Response.json({ error: "Moment and photo are required" }, { status: 400 });
    }

    const photo = await resolveMomentPhoto(momentId, photoId);
    const storageKey = photo?.storageKey?.trim() ?? "";
    if (!storageKey) {
      return Response.json({ error: "Photo not found" }, { status: 404 });
    }

    const loaded =
      variant === "thumb" ? await readMomentThumbBytes(storageKey) : await readMomentBlobBytes(storageKey);
    if (!loaded) {
      return Response.json({ error: "Could not read photo bytes" }, { status: 503 });
    }

    const filename = photo?.originalFilename || (variant === "thumb" ? "thumb.jpg" : "photo.jpg");
    const contentType =
      loaded.contentType || (filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
    return new Response(Buffer.from(loaded.bytes), {
      headers: {
        "Cache-Control": variant === "thumb" ? "private, max-age=86400" : "private, max-age=60",
        "Content-Disposition": `inline; filename="${filename.replace(/"/g, "")}"`,
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const pin = request.headers.get("x-travelos-admin-pin");
    if (!isAdminPinValid(pin)) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const formData = await request.formData();
    const momentId = String(formData.get("momentId") ?? "");
    const photoId = String(formData.get("photoId") ?? "");
    const takenAt = String(formData.get("takenAt") ?? "").trim();
    const file = formData.get("file");
    const original = formData.get("original");

    if (!momentId) {
      return Response.json({ error: "Moment and photo file are required" }, { status: 400 });
    }

    if (photoId && isUploadBlob(original)) {
      const originalName = uploadFilename(original, "original.bin");
      const originalBlob = await storeMomentBinary(
        `travelos/moments/photos/${momentId}/original-${Date.now()}-${cleanFilename(originalName)}`,
        original,
      );
      const saved = await setPhotoOriginal(momentId, photoId, originalBlob.url);
      if (!saved) {
        return Response.json({ error: "Moment not found" }, { status: 404 });
      }

      return Response.json({ photo: saved.photo });
    }

    if (!isUploadBlob(file)) {
      return Response.json({ error: "Moment and photo file are required" }, { status: 400 });
    }

    const displayName = uploadFilename(file, "photo.jpg");
    const displayBlob = await storeMomentBinary(
      `travelos/moments/photos/${momentId}/${Date.now()}-${cleanFilename(displayName)}`,
      file,
    );

    const now = new Date().toISOString();
    const photo: MomentPhoto = {
      coordinates: readCoordinates(formData),
      createdAt: now,
      id: makeMomentId("moment_photo"),
      momentId,
      originalFilename: displayName,
      originalStorageKey: null,
      storageKey: displayBlob.url,
      takenAt: takenAt ? new Date(takenAt).toISOString() : now,
    };

    const content = await addPhotoToMoment(momentId, photo);
    if (!content) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
    }

    scheduleMomentIndex(momentId);

    return Response.json({ photo });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const pin = request.headers.get("x-travelos-admin-pin");
    if (!isAdminPinValid(pin)) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const url = new URL(request.url);
    const momentId = url.searchParams.get("momentId") ?? "";
    const photoId = url.searchParams.get("photoId") ?? "";
    if (!momentId || !photoId) {
      return Response.json({ error: "Moment and photo are required" }, { status: 400 });
    }

    const content = await removePhotoFromMoment(momentId, photoId);
    if (!content) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}
