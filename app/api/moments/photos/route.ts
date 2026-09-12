import { createHash } from "node:crypto";
import { photoFromDriveFileId } from "@/lib/drive-photo-index";
import { isUploadBlob, uploadFilename } from "@/lib/form-upload";
import { readMomentBlobBytes, readMomentThumbBytes } from "@/lib/moment-blob";
import {
  addPhotoToMoment,
  getMomentById,
  isAdminPinValid,
  momentApiErrorResponse,
  rememberUploadedDisplayPhoto,
  rememberUploadedOriginal,
  removePhotoFromMoment,
  resolveMomentPhoto,
  setPhotoOriginal,
  storeMomentBinary,
} from "@/lib/moment-store";
import { contentTypeForMomentMedia, makeMomentId, momentMediaKindFromFile } from "@/lib/moments";
import type { MomentPhoto } from "@/lib/types";
import { photoUploadMetadata } from "@/lib/photo-upload-metadata";
import { readOriginalCaptureMetadata, captureMetadataPhotoFields } from "@/lib/original-capture-metadata";

export const runtime = "nodejs";
export const maxDuration = 180;

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
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
    const fileId = url.searchParams.get("file")?.trim() ?? "";
    const variant = url.searchParams.get("variant")?.trim() === "thumb" ? "thumb" : "display";
    if (!momentId || !photoId) {
      return Response.json({ error: "Moment and photo are required" }, { status: 400 });
    }

    const fromListing = fileId ? photoFromDriveFileId(momentId, photoId, fileId) : null;
    const resolved = await resolveMomentPhoto(momentId, photoId);
    const photo = resolved
      ? fromListing
        ? { ...resolved, storageKey: fromListing.storageKey }
        : resolved
      : fromListing;
    const storageKey = photo?.storageKey?.trim() ?? "";
    if (!photo || !storageKey) {
      return Response.json({ error: "Photo not found", reason: "missing-photo" }, { status: 404 });
    }

    const loaded =
      variant === "thumb" ? await readMomentThumbBytes(storageKey) : await readMomentBlobBytes(storageKey);
    if (!loaded) {
      return Response.json({ error: "Could not read photo bytes", reason: "binary-miss" }, { status: 503 });
    }

    const filename = photo?.originalFilename || (variant === "thumb" ? "thumb.jpg" : "photo.jpg");
    const contentType =
      loaded.contentType ||
      contentTypeForMomentMedia(
        {
          kind: photo.kind,
          mimeType: photo.mimeType,
          originalFilename: filename,
        },
        filename.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg",
      );
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
    const file = formData.get("file");
    const original = formData.get("original");

    if (!momentId) {
      return Response.json({ error: "Moment and photo file are required" }, { status: 400 });
    }

    if (photoId && isUploadBlob(original)) {
      const capture = await readOriginalCaptureMetadata(original);
      const originalName = uploadFilename(original, "original.bin");
      const originalBlob = await storeMomentBinary(
        `travelos/moments/photos/${momentId}/original-${Date.now()}-${cleanFilename(originalName)}`,
        original,
      );
      rememberUploadedOriginal(momentId, photoId, originalBlob.url, capture);
      const saved = await setPhotoOriginal(momentId, photoId, originalBlob.url, capture);
      if (!saved) return Response.json({ error: "Photo not found" }, { status: 404 });
      return Response.json({
        photo: {
          id: photoId,
          momentId,
          originalStorageKey: originalBlob.url,
          ...captureMetadataPhotoFields(capture),
        },
      });
    }

    if (!isUploadBlob(file)) {
      return Response.json({ error: "Moment and photo file are required" }, { status: 400 });
    }

    const displayName = uploadFilename(file, "photo.jpg");
    const uploadId = String(formData.get("uploadId") ?? "").trim();
    const displayPhotoId = uploadId
      ? `moment_photo_${createHash("sha256").update(`${momentId}\0${uploadId}`).digest("hex")}`
      : makeMomentId("moment_photo");
    if (uploadId) {
      // Read only this moment shard. A lost response must not create another
      // photo or replace EXIF/original metadata attached after the first write.
      const existing = (await getMomentById(momentId))?.photos.find((photo) => photo.id === displayPhotoId);
      if (existing) {
        // The read may include an in-memory upload whose first durable write
        // failed; acknowledge only after that same photo has been persisted.
        const content = await addPhotoToMoment(momentId, existing);
        if (!content) return Response.json({ error: "Moment not found" }, { status: 404 });
        return Response.json({ photo: existing });
      }
    }
    // Tiny JPEGs and HEIC arrive unchanged here; resized displays may lack EXIF.
    // The later original upload enriches those photos from the preserved source.
    const capture = await readOriginalCaptureMetadata(file);
    const displayBlob = await storeMomentBinary(
      `travelos/moments/photos/${momentId}/${Date.now()}-${cleanFilename(displayName)}`,
      file,
    );

    const now = new Date().toISOString();
    const mediaFile = { name: displayName, type: file.type };
    const photo: MomentPhoto = {
      ...photoUploadMetadata(formData),
      ...captureMetadataPhotoFields(capture),
      createdAt: now,
      id: displayPhotoId,
      kind: momentMediaKindFromFile(mediaFile),
      mimeType: file.type || null,
      momentId,
      originalFilename: displayName,
      originalStorageKey: null,
      storageKey: displayBlob.url,
    };

    rememberUploadedDisplayPhoto(momentId, photo);
    const content = await addPhotoToMoment(momentId, photo);
    if (!content) return Response.json({ error: "Moment not found" }, { status: 404 });

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
