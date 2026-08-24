"use client";

import { maxUploadBytes, prepareDisplayPhoto, shouldKeepOriginal } from "@/lib/prepare-photo";
import type { GeoPoint, MomentPhoto, TravelJob, TravelMoment } from "@/lib/types";

export function pinHeaders(pin: string) {
  return { "x-travelos-admin-pin": pin };
}

async function readError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function createCaptureMoment(input: {
  command?: string | null;
  coordinates: GeoPoint | null;
  note?: string;
  pin: string;
  time: string;
}) {
  const response = await fetch("/api/moments", {
    body: JSON.stringify({
      command: input.command ?? null,
      coordinates: input.coordinates,
      note: input.note ?? "",
      time: input.time,
    }),
    headers: {
      "content-type": "application/json",
      ...pinHeaders(input.pin),
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Could not save this moment."));
  }

  return (await response.json()) as { job: TravelJob | null; moment: TravelMoment };
}

export async function finalizeCaptureMoment(input: {
  command: string | null;
  coordinates: GeoPoint | null;
  momentId: string;
  note: string;
  pin: string;
  time: string;
}) {
  const response = await fetch("/api/moments", {
    body: JSON.stringify({
      moment: {
        command: input.command,
        coordinates: input.coordinates,
        id: input.momentId,
        note: input.note,
        time: input.time,
      },
    }),
    headers: {
      "content-type": "application/json",
      ...pinHeaders(input.pin),
    },
    method: "PUT",
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Could not save this moment."));
  }

  return (await response.json()) as { job: TravelJob | null; moment: TravelMoment };
}

export async function uploadDisplayPhoto(input: {
  coordinates: GeoPoint | null;
  file: File;
  momentId: string;
  pin: string;
  signal?: AbortSignal;
  takenAt: string;
}) {
  const display = await prepareDisplayPhoto(input.file);
  if (display.size > maxUploadBytes) {
    throw new Error("Photo is still too large after compression. Please choose a smaller photo.");
  }

  const formData = new FormData();
  formData.set("file", display);
  formData.set("momentId", input.momentId);
  formData.set("takenAt", input.takenAt);
  if (input.coordinates) {
    formData.set("latitude", String(input.coordinates.latitude));
    formData.set("longitude", String(input.coordinates.longitude));
  }

  const response = await fetch("/api/moments/photos", {
    body: formData,
    headers: pinHeaders(input.pin),
    method: "POST",
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(await readError(response, "Photo upload failed."));
  }

  const payload = (await response.json()) as { photo: MomentPhoto };
  return { display, photo: payload.photo };
}

export function uploadOriginalPhotoInBackground(input: {
  display: File;
  momentId: string;
  original: File;
  photoId: string;
  pin: string;
}) {
  if (!shouldKeepOriginal(input.original, input.display)) {
    return;
  }

  const formData = new FormData();
  formData.set("momentId", input.momentId);
  formData.set("original", input.original);
  formData.set("photoId", input.photoId);

  void fetch("/api/moments/photos", {
    body: formData,
    headers: pinHeaders(input.pin),
    method: "POST",
  }).catch(() => {
    // Originals are durable when they land; they must never block Capture.
  });
}

export async function uploadMomentAudio(input: {
  blob: Blob;
  momentId: string;
  pin: string;
  signal?: AbortSignal;
}) {
  const audioData = new FormData();
  audioData.set("momentId", input.momentId);
  audioData.set("file", new File([input.blob], "moment-audio.webm", { type: input.blob.type || "audio/webm" }));
  const response = await fetch("/api/moments/audio", {
    body: audioData,
    headers: pinHeaders(input.pin),
    method: "POST",
    signal: input.signal,
  });
  if (!response.ok) {
    throw new Error(await readError(response, "Audio upload failed."));
  }
}

export function removeUploadedPhotoInBackground(input: {
  momentId: string;
  photoId: string;
  pin: string;
}) {
  const params = new URLSearchParams({ momentId: input.momentId, photoId: input.photoId });
  void fetch(`/api/moments/photos?${params.toString()}`, {
    headers: pinHeaders(input.pin),
    method: "DELETE",
  }).catch(() => {
    // Removing a retake from the warehouse is best-effort.
  });
}

export function clearMomentAudioInBackground(input: { momentId: string; pin: string }) {
  const params = new URLSearchParams({ momentId: input.momentId });
  void fetch(`/api/moments/audio?${params.toString()}`, {
    headers: pinHeaders(input.pin),
    method: "DELETE",
  }).catch(() => {
    // Clearing a retake is best-effort.
  });
}
