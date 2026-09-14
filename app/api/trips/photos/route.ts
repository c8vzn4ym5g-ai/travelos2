import { putVideoBinary } from "@/lib/drive-warehouse";
import { addPhotoToTrip, isAdminPinValid, isBlobConfigured } from "@/lib/editable-store";
import type { Photo } from "@/lib/types";
import { readEditorTripRecord } from "@/lib/editor-trip-read";
import { saveDriveTripWithCatalog } from "@/lib/drive-trips";
import { prepareTripSave } from "@/lib/trip-publication";
import { seedTripDetails } from "@/lib/trips";

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

  try {
    const selected = !isBlobConfigured()
      ? await readEditorTripRecord(tripId) ?? seedTripDetails.find(trip => trip.id === tripId)
      : null;
    if (!isBlobConfigured() && !selected) return Response.json({ error: "Trip not found" }, { status: 404 });
    const blob = await putVideoBinary({ bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type || "image/jpeg", name: `travelos__trip_photo__${Date.now()}-${cleanFilename(file.name)}` });

    const now = new Date().toISOString();
    const photo: Photo = {
      id: `trip_photo_${crypto.randomUUID()}`,
      tripId,
      storageKey: `/api/trips/media?id=${blob.id}`,
      originalFilename: file.name,
      mimeType: file.type || "image/jpeg",
      caption: caption || null,
      takenAt: takenAt ? new Date(takenAt).toISOString() : null,
      coordinates: null,
      cameraMake: null,
      cameraModel: null,
      createdAt: now,
    };

    if (selected) {
      // Uploads can take time: append to the latest selected draft, not its pre-upload copy.
      const current = await readEditorTripRecord(tripId) ?? selected;
      const draft = prepareTripSave(current, { ...current, photos: [photo, ...current.photos], updatedAt: new Date().toISOString() });
      const { trip, warning } = await saveDriveTripWithCatalog(draft);
      return Response.json({ content: { trips: [trip], updatedAt: trip.updatedAt }, trip, photo, ...(warning ? { warning } : {}) });
    }
    const content = await addPhotoToTrip(tripId, photo);

    return Response.json({ content, photo });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "素材尚未加入遊記，請再試一次。" }, { status: 500 });
  }
}

