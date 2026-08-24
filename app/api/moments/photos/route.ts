import { put } from "@vercel/blob";
import { addPhotoToMoment, isAdminPinValid } from "@/lib/moment-store";
import { makeMomentId } from "@/lib/moments";
import type { GeoPoint, MomentPhoto } from "@/lib/types";

export const runtime = "nodejs";

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

export async function POST(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const formData = await request.formData();
  const momentId = String(formData.get("momentId") ?? "");
  const takenAt = String(formData.get("takenAt") ?? "").trim();
  const file = formData.get("file");
  const original = formData.get("original");

  if (!momentId || !(file instanceof File)) {
    return Response.json({ error: "Moment and photo file are required" }, { status: 400 });
  }

  const displayBlob = await put(
    `travelos/moments/photos/${momentId}/${Date.now()}-${cleanFilename(file.name)}`,
    file,
    {
      access: "public",
      addRandomSuffix: true,
    },
  );

  let originalStorageKey: string | null = null;
  if (original instanceof File && (original.name !== file.name || original.size !== file.size)) {
    const originalBlob = await put(
      `travelos/moments/photos/${momentId}/original-${Date.now()}-${cleanFilename(original.name)}`,
      original,
      {
        access: "public",
        addRandomSuffix: true,
      },
    );
    originalStorageKey = originalBlob.url;
  }

  const now = new Date().toISOString();
  const photo: MomentPhoto = {
    coordinates: readCoordinates(formData),
    createdAt: now,
    id: makeMomentId("moment_photo"),
    momentId,
    originalFilename: original instanceof File ? original.name : file.name,
    originalStorageKey,
    storageKey: displayBlob.url,
    takenAt: takenAt ? new Date(takenAt).toISOString() : now,
  };

  const content = await addPhotoToMoment(momentId, photo);
  if (!content) {
    return Response.json({ error: "Moment not found" }, { status: 404 });
  }

  return Response.json({ content, photo });
}
