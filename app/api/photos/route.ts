import { put } from "@vercel/blob";
import { addPhotoToTrip, isAdminPinValid } from "@/lib/editable-store";
import type { Photo } from "@/lib/types";

export const runtime = "nodejs";

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function POST(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const formData = await request.formData();
  const tripId = String(formData.get("tripId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const takenAt = String(formData.get("takenAt") ?? "").trim();
  const file = formData.get("file");

  if (!tripId || !(file instanceof File)) {
    return Response.json({ error: "Trip and photo file are required" }, { status: 400 });
  }

  const blob = await put(`travelos/photos/${tripId}/${Date.now()}-${cleanFilename(file.name)}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const now = new Date().toISOString();
  const photo: Photo = {
    id: `photo_${Date.now()}`,
    tripId,
    storageKey: blob.url,
    originalFilename: file.name,
    caption: caption || null,
    takenAt: takenAt ? new Date(takenAt).toISOString() : now,
    coordinates: null,
    cameraMake: null,
    cameraModel: null,
    createdAt: now,
  };

  const content = await addPhotoToTrip(tripId, photo);
  return Response.json({ content, photo });
}
