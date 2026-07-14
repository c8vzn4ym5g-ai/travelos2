import { put } from "@vercel/blob";
import { addMusicTrackToTrip, isAdminPinValid } from "@/lib/editable-store";
import type { MusicTrack } from "@/lib/types";

export const runtime = "nodejs";

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function cleanVolume(value: FormDataEntryValue | null) {
  const parsed = Number(value ?? 0.32);
  if (Number.isNaN(parsed)) {
    return 0.32;
  }

  return Math.min(1, Math.max(0, parsed));
}

export async function POST(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const formData = await request.formData();
  const tripId = String(formData.get("tripId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const triggerLabel = String(formData.get("triggerLabel") ?? "").trim();
  const audioUrl = String(formData.get("audioUrl") ?? "").trim();
  const file = formData.get("file");

  if (!tripId || !title) {
    return Response.json({ error: "Trip and music title are required" }, { status: 400 });
  }

  let finalAudioUrl = audioUrl;
  if (file instanceof File && file.size > 0) {
    const blob = await put(`travelos/music/${tripId}/${Date.now()}-${cleanFilename(file.name)}`, file, {
      access: "public",
      addRandomSuffix: true,
    });
    finalAudioUrl = blob.url;
  }

  if (!finalAudioUrl) {
    return Response.json({ error: "Upload a music file or paste a public audio URL" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const musicTrack: MusicTrack = {
    id: `music_${Date.now()}`,
    tripId,
    title,
    audioUrl: finalAudioUrl,
    triggerLabel: triggerLabel || title,
    volume: cleanVolume(formData.get("volume")),
    enabled: true,
    createdAt: now,
  };

  const content = await addMusicTrackToTrip(tripId, musicTrack);
  return Response.json({ content, musicTrack });
}
