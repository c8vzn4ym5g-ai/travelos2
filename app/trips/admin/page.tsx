"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TravelOSContent } from "@/lib/editable-store";
import type { GeoPoint, JournalEntry, Photo, Place, PlaceType, RouteTransport, TravelRouteSegment, TravelVisibility, TripDetail } from "@/lib/types";

type TravelContentResponse = {
  content: TravelOSContent;
  status: {
    configured: boolean;
    source: "blob" | "seed";
  };
};

type TripTextField = "city" | "country" | "slug" | "summary" | "title";
type TripDateField = "endDate" | "startDate";
type JournalTextField = "body" | "entryDate" | "mood" | "storyPhotoId" | "title" | "weatherSummary";
type PhotoTextField = "caption" | "originalFilename" | "takenAt";
type PlaceTextField = "address" | "city" | "country" | "name" | "notes";
type RouteTextField = "fromLabel" | "linkedJournalEntryId" | "linkedPhotoId" | "linkedPlaceId" | "note" | "toLabel";

const adminSessionKey = "travelos-admin-pin";
const inputClass =
  "mt-2 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const textareaClass = `${inputClass} min-h-28 leading-6`;
const primaryButtonClass =
  "travel-label rounded-full border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60";
const smallButtonClass =
  "travel-label rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40";
const supportedUploadTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxUploadBytes = 4_500_000;

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function Field({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="travel-label text-sm font-semibold text-zinc-700">{label}</span>
      <input className={inputClass} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="travel-label text-sm font-semibold text-zinc-700">{label}</span>
      <textarea className={textareaClass} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">{eyebrow}</p>
      <h2 className="travel-display mt-2 text-2xl font-semibold">{title}</h2>
    </div>
  );
}

function toDateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

function toDateTimeInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatCoordinate(value: number | undefined) {
  return typeof value === "number" ? String(value) : "";
}

function parseCoordinate(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function updatePoint(point: GeoPoint | null, field: keyof GeoPoint, value: string): GeoPoint | null {
  const parsed = parseCoordinate(value);
  const next = point ?? { latitude: 0, longitude: 0 };

  if (parsed === null) {
    return point;
  }

  return {
    ...next,
    [field]: parsed,
  };
}

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function replaceTrip(trips: TripDetail[], tripId: string, updater: (trip: TripDetail) => TripDetail) {
  return trips.map((trip) =>
    trip.id === tripId
      ? {
          ...updater(trip),
          updatedAt: nowIso(),
        }
      : trip,
  );
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return next;
}

function waitWithTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

async function resizePhotoForUpload(file: File) {
  if (!supportedUploadTypes.has(file.type)) {
    throw new Error("Please use JPG, PNG, or WebP. Phone HEIC photos need to be converted before upload.");
  }

  if (!file.type.startsWith("image/") || file.size < 1_500_000) {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const image = new Image();
    image.src = imageUrl;
    await waitWithTimeout(image.decode(), 12000, "Photo preparation timed out. Try a smaller JPG photo.");

    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }

    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) {
      return file;
    }

    const filename = file.name.replace(/\.[^.]+$/, "") || "trip-photo";
    return new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function uploadTripPhotoWithProgress(
  formData: FormData,
  pin: string,
  onProgress: (progress: number) => void,
): Promise<{ content: TravelOSContent; photo: Photo }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeout = window.setTimeout(() => {
      xhr.abort();
      reject(new DOMException("Photo upload timed out.", "AbortError"));
    }, 45000);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) {
        onProgress(1);
        return;
      }

      onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
    };

    xhr.onload = () => {
      window.clearTimeout(timeout);
      const data = JSON.parse(xhr.responseText || "{}") as { content?: TravelOSContent; error?: string; photo?: Photo };

      if (xhr.status < 200 || xhr.status >= 300 || !data.content || !data.photo) {
        reject(new Error(data.error ?? "Photo upload failed."));
        return;
      }

      onProgress(100);
      resolve({ content: data.content, photo: data.photo });
    };

    xhr.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("Network failed during photo upload."));
    };

    xhr.onabort = () => {
      window.clearTimeout(timeout);
      reject(new DOMException("Photo upload timed out.", "AbortError"));
    };

    xhr.open("POST", "/api/trips/photos");
    xhr.setRequestHeader("x-travelos-admin-pin", pin);
    xhr.send(formData);
  });
}

export default function TravelAdminPage() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"blob" | "seed">("seed");
  const [saving, setSaving] = useState(false);
  const [uploadingTripId, setUploadingTripId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("Unlock admin to edit existing trips or create a new draft.");

  useEffect(() => {
    const storedPin = window.sessionStorage.getItem(adminSessionKey);
    if (storedPin) {
      setPin(storedPin);
      setAuthenticated(true);
      setMessage("Admin session unlocked from the shared admin workspace.");
    }
  }, []);

  async function loadContent() {
    setMessage("Loading Travel content...");
    const response = await fetch("/api/trips/content", { cache: "no-store" });
    const data = (await response.json()) as TravelContentResponse;
    const sortedTrips = [...data.content.trips].sort((first, second) => second.startDate.localeCompare(first.startDate));
    setTrips(sortedTrips);
    setActiveTripId((current) => current ?? sortedTrips[0]?.id ?? null);
    setConfigured(data.status.configured);
    setSource(data.status.source);
    setMessage(data.status.configured ? "Ready to edit existing trips." : "Storage setup needed before saves work on Vercel.");
  }

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    loadContent().catch(() => setMessage("Could not load Travel content."));
  }, [authenticated]);

  async function verifyPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckingPin(true);
    setMessage("Checking admin PIN...");

    const response = await fetch("/api/coffee/admin", {
      headers: { "x-travelos-admin-pin": pin },
      method: "POST",
    });

    setCheckingPin(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Admin PIN check failed.");
      return;
    }

    window.sessionStorage.setItem(adminSessionKey, pin);
    setAuthenticated(true);
  }

  const sortedTrips = useMemo(
    () => [...trips].sort((first, second) => second.startDate.localeCompare(first.startDate)),
    [trips],
  );
  const activeTrip = sortedTrips.find((trip) => trip.id === activeTripId) ?? sortedTrips[0] ?? null;

  function updateTrip(field: TripTextField | TripDateField, value: string) {
    if (!activeTrip) {
      return;
    }

    setTrips((current) =>
      current.map((trip) =>
        trip.id === activeTrip.id
          ? {
              ...trip,
              [field]: value,
              updatedAt: new Date().toISOString(),
            }
          : trip,
      ),
    );
  }

  function updateActiveTrip(updater: (trip: TripDetail) => TripDetail) {
    if (!activeTrip) {
      return;
    }

    setTrips((current) => replaceTrip(current, activeTrip.id, updater));
  }

  function updateVisibility(value: TravelVisibility) {
    if (!activeTrip) {
      return;
    }

    setTrips((current) =>
      current.map((trip) =>
        trip.id === activeTrip.id
          ? {
              ...trip,
              visibility: value,
              updatedAt: new Date().toISOString(),
            }
          : trip,
      ),
    );
  }

  function updateRating(value: string) {
    if (!activeTrip) {
      return;
    }

    setTrips((current) =>
      current.map((trip) =>
        trip.id === activeTrip.id
          ? {
              ...trip,
              rating: value ? Number(value) : null,
              updatedAt: new Date().toISOString(),
            }
          : trip,
      ),
    );
  }

  function updateTripCoordinate(field: keyof GeoPoint, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      coordinates: updatePoint(trip.coordinates, field, value),
    }));
  }

  function addPlace() {
    if (!activeTrip) {
      return;
    }

    const now = nowIso();
    const place: Place = {
      address: null,
      city: activeTrip.city,
      coordinates: activeTrip.coordinates,
      country: activeTrip.country,
      createdAt: now,
      id: makeId("place"),
      name: "New map pin",
      notes: "Add a short visitor note for this stop.",
      rating: null,
      tripId: activeTrip.id,
      type: "attraction",
      updatedAt: now,
    };

    updateActiveTrip((trip) => ({ ...trip, places: [...trip.places, place] }));
    setMessage("New map pin added. Edit the details and save trip changes.");
  }

  function updatePlace(placeId: string, field: PlaceTextField, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      places: trip.places.map((place) =>
        place.id === placeId
          ? {
              ...place,
              [field]: field === "address" || field === "notes" ? value || null : value,
              updatedAt: nowIso(),
            }
          : place,
      ),
    }));
  }

  function updatePlaceType(placeId: string, value: PlaceType) {
    updateActiveTrip((trip) => ({
      ...trip,
      places: trip.places.map((place) => (place.id === placeId ? { ...place, type: value, updatedAt: nowIso() } : place)),
    }));
  }

  function updatePlaceRating(placeId: string, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      places: trip.places.map((place) =>
        place.id === placeId
          ? {
              ...place,
              rating: value ? Number(value) : null,
              updatedAt: nowIso(),
            }
          : place,
      ),
    }));
  }

  function updatePlaceCoordinate(placeId: string, field: keyof GeoPoint, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      places: trip.places.map((place) =>
        place.id === placeId
          ? {
              ...place,
              coordinates: updatePoint(place.coordinates, field, value),
              updatedAt: nowIso(),
            }
          : place,
      ),
    }));
  }

  function removePlace(placeId: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      places: trip.places.filter((place) => place.id !== placeId),
      travelRoute: (trip.travelRoute ?? []).map((segment) =>
        segment.linkedPlaceId === placeId ? { ...segment, linkedPlaceId: null, updatedAt: nowIso() } : segment,
      ),
    }));
  }

  function addRouteSegment() {
    if (!activeTrip) {
      return;
    }

    const now = nowIso();
    const start = activeTrip.coordinates ?? activeTrip.places.find((place) => place.coordinates)?.coordinates ?? { latitude: 0, longitude: 0 };
    const end = activeTrip.places.find((place) => place.coordinates)?.coordinates ?? start;
    const segment: TravelRouteSegment = {
      createdAt: now,
      from: start,
      fromLabel: activeTrip.city || "Start",
      id: makeId("route"),
      linkedJournalEntryId: activeTrip.journalEntries[0]?.id ?? null,
      linkedPhotoId: activeTrip.photos[0]?.id ?? null,
      linkedPlaceId: activeTrip.places[0]?.id ?? null,
      note: "Describe why this movement matters.",
      to: end,
      toLabel: activeTrip.places[0]?.name ?? "Next stop",
      transport: "car",
      tripId: activeTrip.id,
      updatedAt: now,
      visibility: "public",
    };

    updateActiveTrip((trip) => ({ ...trip, travelRoute: [...(trip.travelRoute ?? []), segment] }));
    setMessage("New route segment added. Edit it, then save trip changes.");
  }

  function updateRouteSegment(segmentId: string, field: RouteTextField, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      travelRoute: (trip.travelRoute ?? []).map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              [field]: field.startsWith("linked") || field === "note" ? value || null : value,
              updatedAt: nowIso(),
            }
          : segment,
      ),
    }));
  }

  function updateRouteCoordinate(segmentId: string, pointName: "from" | "to", field: keyof GeoPoint, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      travelRoute: (trip.travelRoute ?? []).map((segment) =>
        segment.id === segmentId
          ? {
              ...segment,
              [pointName]: updatePoint(segment[pointName], field, value) ?? segment[pointName],
              updatedAt: nowIso(),
            }
          : segment,
      ),
    }));
  }

  function updateRouteTransport(segmentId: string, value: RouteTransport) {
    updateActiveTrip((trip) => ({
      ...trip,
      travelRoute: (trip.travelRoute ?? []).map((segment) =>
        segment.id === segmentId ? { ...segment, transport: value, updatedAt: nowIso() } : segment,
      ),
    }));
  }

  function updateRouteVisibility(segmentId: string, value: TravelVisibility) {
    updateActiveTrip((trip) => ({
      ...trip,
      travelRoute: (trip.travelRoute ?? []).map((segment) =>
        segment.id === segmentId ? { ...segment, visibility: value, updatedAt: nowIso() } : segment,
      ),
    }));
  }

  function removeRouteSegment(segmentId: string) {
    updateActiveTrip((trip) => ({ ...trip, travelRoute: (trip.travelRoute ?? []).filter((segment) => segment.id !== segmentId) }));
  }

  function addJournalEntry() {
    if (!activeTrip) {
      return;
    }

    const now = nowIso();
    const entry: JournalEntry = {
      id: makeId("journal"),
      tripId: activeTrip.id,
      title: "New journal note",
      body: "Write the memory here.",
      entryDate: activeTrip.startDate || now.slice(0, 10),
      storyPhotoId: null,
      mood: null,
      weatherSummary: null,
      aiSummary: null,
      createdAt: now,
      updatedAt: now,
    };

    updateActiveTrip((trip) => ({ ...trip, journalEntries: [entry, ...trip.journalEntries] }));
    setMessage("New journal entry added. Edit it, then save trip changes.");
  }

  function updateJournalEntry(entryId: string, field: JournalTextField, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      journalEntries: trip.journalEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]: field === "mood" || field === "storyPhotoId" || field === "weatherSummary" ? value || null : value,
              updatedAt: nowIso(),
            }
          : entry,
      ),
    }));
  }

  function removeJournalEntry(entryId: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      journalEntries: trip.journalEntries.filter((entry) => entry.id !== entryId),
    }));
  }

  function moveJournalEntry(index: number, direction: -1 | 1) {
    updateActiveTrip((trip) => ({ ...trip, journalEntries: moveItem(trip.journalEntries, index, direction) }));
  }

  function updatePhoto(photoId: string, field: PhotoTextField, value: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      photos: trip.photos.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              [field]: field === "caption" ? value || null : field === "takenAt" ? fromDateTimeInput(value) : value,
            }
          : photo,
      ),
    }));
  }

  function removePhoto(photoId: string) {
    updateActiveTrip((trip) => ({
      ...trip,
      coverPhotoId: trip.coverPhotoId === photoId ? null : trip.coverPhotoId,
      photos: trip.photos.filter((photo) => photo.id !== photoId),
      journalEntries: trip.journalEntries.map((entry) =>
        entry.storyPhotoId === photoId
          ? {
              ...entry,
              storyPhotoId: null,
              updatedAt: nowIso(),
            }
          : entry,
      ),
    }));
  }

  function movePhoto(index: number, direction: -1 | 1) {
    updateActiveTrip((trip) => ({ ...trip, photos: moveItem(trip.photos, index, direction) }));
  }

  function setCoverPhoto(photoId: string) {
    updateActiveTrip((trip) => ({ ...trip, coverPhotoId: photoId }));
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTrip) {
      return;
    }

    setUploadingTripId(activeTrip.id);
    setUploadProgress(null);
    setMessage("Preparing selected trip photo...");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedFile = formData.get("file");

    if (!(selectedFile instanceof File)) {
      setMessage("Choose a photo file first.");
      setUploadingTripId(null);
      return;
    }

    try {
      const uploadFile = await resizePhotoForUpload(selectedFile);
      if (uploadFile.size > maxUploadBytes) {
        setMessage("Photo is still too large after compression. Please choose a smaller JPG, PNG, or WebP photo.");
        return;
      }

      formData.set("file", uploadFile);
      formData.set("tripId", activeTrip.id);
      setMessage("Saving trip before photo upload...");

      const saveResponse = await fetch("/api/trips/content", {
        body: JSON.stringify({ trip: activeTrip }),
        headers: {
          "content-type": "application/json",
          "x-travelos-admin-pin": pin,
        },
        method: "PUT",
      });

      if (!saveResponse.ok) {
        const data = (await saveResponse.json()) as { error?: string };
        setMessage(data.error ?? "Save before photo upload failed.");
        return;
      }

      setUploadProgress(0);
      setMessage("Uploading trip photo: 0%");

      const data = await uploadTripPhotoWithProgress(formData, pin, (progress) => {
        setUploadProgress(progress);
        setMessage(`Uploading trip photo: ${progress}%`);
      });
      setTrips(data.content.trips);
      setActiveTripId(activeTrip.id);
      form.reset();
      setMessage(`Photo uploaded: ${data.photo.originalFilename}`);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : error instanceof DOMException && error.name === "AbortError"
            ? "Photo upload timed out. Try a smaller photo."
            : "Photo upload failed. Try another image.",
      );
    } finally {
      setUploadingTripId(null);
      setUploadProgress(null);
    }
  }

  async function saveActiveTrip() {
    if (!activeTrip) {
      return;
    }

    if (!activeTrip.title.trim() || !activeTrip.slug.trim() || !activeTrip.country.trim() || !activeTrip.city.trim()) {
      setMessage("Title, slug, country, and city are required.");
      return;
    }

    setSaving(true);
    setMessage("Saving trip changes...");
    const response = await fetch("/api/trips/content", {
      body: JSON.stringify({ trip: activeTrip }),
      headers: {
        "content-type": "application/json",
        "x-travelos-admin-pin": pin,
      },
      method: "PUT",
    });

    setSaving(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Trip save failed.");
      return;
    }

    const data = (await response.json()) as { content: TravelOSContent; trip: TripDetail };
    setTrips(data.content.trips);
    setActiveTripId(data.trip.id);
    setMessage("Saved. Existing trip updated.");
  }

  if (!authenticated) {
    return (
      <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
        <section className="border-b border-sky-100 bg-white/90">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 lg:px-10">
            <Link className="travel-label text-sm font-semibold text-sky-800" href="/admin">
              Admin
            </Link>
            <div>
              <p className="travel-label text-sm font-semibold uppercase text-sky-700">Travel admin</p>
              <h1 className="travel-display mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Unlock Travel editor</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Use the shared admin PIN to edit existing trips or create a new Travel draft.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-md px-6 py-8 lg:px-10">
          <form className="rounded-xl border border-sky-100 bg-white/95 p-6 shadow-sm" onSubmit={verifyPin}>
            <Field label="Admin PIN" onChange={setPin} type="password" value={pin} />
            <button className={`${primaryButtonClass} mt-4 w-full`} disabled={checkingPin || !pin.trim()} type="submit">
              {checkingPin ? "Checking" : "Unlock editor"}
            </button>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{message}</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
      <section className="border-b border-sky-100 bg-[linear-gradient(135deg,_#eff6ff_0%,_#fff7ed_100%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="travel-label text-sm font-semibold text-sky-800" href="/admin">
              Admin
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className={smallButtonClass} href="/trips/new">
                New trip draft
              </Link>
              {activeTrip ? (
                <Link className={smallButtonClass} href={`/trips/${activeTrip.slug}`}>
                  Open public trip
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-end">
            <div>
              <p className="travel-label text-sm font-semibold uppercase text-sky-700">Travel admin</p>
              <h1 className="travel-display mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Edit existing trips</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Manage existing Travel records first. Use “New trip draft” only when you are adding a new journey.
              </p>
            </div>
            <div className="rounded-xl border border-sky-100 bg-white/90 p-4 text-sm leading-6 text-zinc-600">
              <p>{message}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Source: {source} / Storage {configured ? "configured" : "not configured"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[20rem_1fr] lg:px-10">
        <aside className="rounded-xl border border-sky-100 bg-white/95 p-4 shadow-sm">
          <SectionTitle eyebrow="Existing trips" title="Travel records" />
          <div className="mt-5 grid gap-2">
            {sortedTrips.map((trip) => (
              <button
                className={`rounded-lg border px-3 py-3 text-left text-sm transition ${
                  trip.id === activeTrip?.id ? "border-sky-300 bg-sky-50 text-sky-950" : "border-zinc-200 bg-white text-zinc-700 hover:bg-sky-50/60"
                }`}
                key={trip.id}
                onClick={() => setActiveTripId(trip.id)}
                type="button"
              >
                <span className="travel-display block font-semibold">{trip.title}</span>
                <span className="mt-1 block text-xs text-zinc-500">
                  {trip.city}, {trip.country} / {trip.startDate}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {activeTrip ? (
          <section className="rounded-xl border border-sky-100 bg-white/95 p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <SectionTitle eyebrow="Selected trip" title={activeTrip.title} />
              <button className={primaryButtonClass} disabled={saving} onClick={saveActiveTrip} type="button">
                {saving ? "Saving" : "Save trip changes"}
              </button>
            </div>
            <div className="mt-6 grid gap-5">
              <Field label="Title" onChange={(value) => updateTrip("title", value)} value={activeTrip.title} />
              <Field label="Slug" onChange={(value) => updateTrip("slug", value)} value={activeTrip.slug} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Country" onChange={(value) => updateTrip("country", value)} value={activeTrip.country} />
                <Field label="City" onChange={(value) => updateTrip("city", value)} value={activeTrip.city} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Start date" onChange={(value) => updateTrip("startDate", value)} type="date" value={toDateInput(activeTrip.startDate)} />
                <Field label="End date" onChange={(value) => updateTrip("endDate", value)} type="date" value={toDateInput(activeTrip.endDate)} />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="travel-label text-sm font-semibold text-zinc-700">公開狀態</span>
                  <select className={inputClass} onChange={(event) => updateVisibility(event.target.value as TravelVisibility)} value={activeTrip.visibility}>
                    <option value="public">公開：任何人都能閱讀</option>
                    <option value="private">私人：只保留在家庭編輯</option>
                  </select>
                </label>
                <Field label="Rating" onChange={updateRating} type="number" value={activeTrip.rating ? String(activeTrip.rating) : ""} />
              </div>
              <TextArea label="Summary" onChange={(value) => updateTrip("summary", value)} value={activeTrip.summary} />
              <div className="grid gap-3 rounded-lg border border-sky-100 bg-sky-50/60 p-4 text-sm text-zinc-600 sm:grid-cols-4">
                <p>
                  <span className="travel-label block text-xs uppercase text-sky-700">Photos</span>
                  {activeTrip.photos.length}
                </p>
                <p>
                  <span className="travel-label block text-xs uppercase text-sky-700">Journal</span>
                  {activeTrip.journalEntries.length}
                </p>
                <p>
                  <span className="travel-label block text-xs uppercase text-sky-700">Places</span>
                  {activeTrip.places.length}
                </p>
                <p>
                  <span className="travel-label block text-xs uppercase text-sky-700">Costs</span>
                  {activeTrip.costs.length}
                </p>
              </div>
            </div>
            <section className="mt-8 rounded-xl border border-sky-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle eyebrow="Map" title="Pins and route" />
                <div className="flex flex-wrap gap-2">
                  <button className={smallButtonClass} onClick={addPlace} type="button">
                    Add place pin
                  </button>
                  <button className={smallButtonClass} onClick={addRouteSegment} type="button">
                    Add route segment
                  </button>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                Use this to power the visitor journey map. Public/shared routes show on the trip page; private routes stay hidden.
              </p>
              <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="travel-label text-xs font-semibold uppercase text-amber-800">Trip map center</p>
                <div className="mt-3 grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Center latitude"
                    onChange={(value) => updateTripCoordinate("latitude", value)}
                    type="number"
                    value={formatCoordinate(activeTrip.coordinates?.latitude)}
                  />
                  <Field
                    label="Center longitude"
                    onChange={(value) => updateTripCoordinate("longitude", value)}
                    type="number"
                    value={formatCoordinate(activeTrip.coordinates?.longitude)}
                  />
                </div>
              </div>
              <div className="mt-5 grid gap-4">
                {activeTrip.places.map((place, index) => (
                  <article className="rounded-xl border border-sky-100 bg-sky-50/40 p-4" key={place.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="travel-label text-xs font-semibold uppercase text-sky-700">Pin {index + 1}</p>
                      <button className={smallButtonClass} onClick={() => removePlace(place.id)} type="button">
                        Delete pin
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4">
                      <Field label="Place name" onChange={(value) => updatePlace(place.id, "name", value)} value={place.name} />
                      <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                          <span className="travel-label text-sm font-semibold text-zinc-700">Type</span>
                          <select className={inputClass} onChange={(event) => updatePlaceType(place.id, event.target.value as PlaceType)} value={place.type}>
                            {["hotel", "restaurant", "attraction", "airport", "station", "shopping", "other"].map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                        </label>
                        <Field label="City" onChange={(value) => updatePlace(place.id, "city", value)} value={place.city} />
                        <Field label="Country" onChange={(value) => updatePlace(place.id, "country", value)} value={place.country} />
                      </div>
                      <Field label="Address" onChange={(value) => updatePlace(place.id, "address", value)} value={place.address ?? ""} />
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field
                          label="Latitude"
                          onChange={(value) => updatePlaceCoordinate(place.id, "latitude", value)}
                          type="number"
                          value={formatCoordinate(place.coordinates?.latitude)}
                        />
                        <Field
                          label="Longitude"
                          onChange={(value) => updatePlaceCoordinate(place.id, "longitude", value)}
                          type="number"
                          value={formatCoordinate(place.coordinates?.longitude)}
                        />
                        <Field label="Rating" onChange={(value) => updatePlaceRating(place.id, value)} type="number" value={place.rating ? String(place.rating) : ""} />
                      </div>
                      <TextArea label="Visitor pin note" onChange={(value) => updatePlace(place.id, "notes", value)} value={place.notes ?? ""} />
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-5 grid gap-4">
                {(activeTrip.travelRoute ?? []).map((segment, index) => (
                  <article className="rounded-xl border border-teal-100 bg-teal-50/40 p-4" key={segment.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="travel-label text-xs font-semibold uppercase text-teal-800">Route {index + 1}</p>
                      <button className={smallButtonClass} onClick={() => removeRouteSegment(segment.id)} type="button">
                        Delete route
                      </button>
                    </div>
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="From label" onChange={(value) => updateRouteSegment(segment.id, "fromLabel", value)} value={segment.fromLabel} />
                        <Field label="To label" onChange={(value) => updateRouteSegment(segment.id, "toLabel", value)} value={segment.toLabel} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-4">
                        <Field label="From latitude" onChange={(value) => updateRouteCoordinate(segment.id, "from", "latitude", value)} type="number" value={formatCoordinate(segment.from.latitude)} />
                        <Field label="From longitude" onChange={(value) => updateRouteCoordinate(segment.id, "from", "longitude", value)} type="number" value={formatCoordinate(segment.from.longitude)} />
                        <Field label="To latitude" onChange={(value) => updateRouteCoordinate(segment.id, "to", "latitude", value)} type="number" value={formatCoordinate(segment.to.latitude)} />
                        <Field label="To longitude" onChange={(value) => updateRouteCoordinate(segment.id, "to", "longitude", value)} type="number" value={formatCoordinate(segment.to.longitude)} />
                      </div>
                      <div className="grid gap-4 sm:grid-cols-3">
                        <label className="block">
                          <span className="travel-label text-sm font-semibold text-zinc-700">Transport</span>
                          <select className={inputClass} onChange={(event) => updateRouteTransport(segment.id, event.target.value as RouteTransport)} value={segment.transport}>
                            {["flight", "train", "car", "walk", "boat", "other"].map((transport) => (
                              <option key={transport} value={transport}>
                                {transport}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="travel-label text-sm font-semibold text-zinc-700">Visibility</span>
                          <select className={inputClass} onChange={(event) => updateRouteVisibility(segment.id, event.target.value as TravelVisibility)} value={segment.visibility}>
                            <option value="public">Public</option>
                            <option value="shared">Shared</option>
                            <option value="private">Private</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="travel-label text-sm font-semibold text-zinc-700">Linked place</span>
                          <select className={inputClass} onChange={(event) => updateRouteSegment(segment.id, "linkedPlaceId", event.target.value)} value={segment.linkedPlaceId ?? ""}>
                            <option value="">No place link</option>
                            {activeTrip.places.map((place) => (
                              <option key={place.id} value={place.id}>
                                {place.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                          <span className="travel-label text-sm font-semibold text-zinc-700">Linked story</span>
                          <select className={inputClass} onChange={(event) => updateRouteSegment(segment.id, "linkedJournalEntryId", event.target.value)} value={segment.linkedJournalEntryId ?? ""}>
                            <option value="">No story link</option>
                            {activeTrip.journalEntries.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="block">
                          <span className="travel-label text-sm font-semibold text-zinc-700">Linked photo</span>
                          <select className={inputClass} onChange={(event) => updateRouteSegment(segment.id, "linkedPhotoId", event.target.value)} value={segment.linkedPhotoId ?? ""}>
                            <option value="">No photo link</option>
                            {activeTrip.photos.map((photo, photoIndex) => (
                              <option key={photo.id} value={photo.id}>
                                {photoIndex + 1}. {photo.caption ?? photo.originalFilename}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <TextArea label="Route note" onChange={(value) => updateRouteSegment(segment.id, "note", value)} value={segment.note ?? ""} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="mt-8 rounded-xl border border-sky-100 bg-sky-50/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle eyebrow="Journal" title="Trip journal entries" />
                <button className={smallButtonClass} onClick={addJournalEntry} type="button">
                  Add journal entry
                </button>
              </div>
              <div className="mt-5 grid gap-4">
                {activeTrip.journalEntries.map((entry, index) => (
                  <article className="rounded-xl border border-sky-100 bg-white p-4" key={entry.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="travel-label text-xs font-semibold uppercase text-sky-700">Entry {index + 1}</p>
                      <div className="flex flex-wrap gap-2">
                        <button className={smallButtonClass} disabled={index === 0} onClick={() => moveJournalEntry(index, -1)} type="button">
                          Move up
                        </button>
                        <button
                          className={smallButtonClass}
                          disabled={index === activeTrip.journalEntries.length - 1}
                          onClick={() => moveJournalEntry(index, 1)}
                          type="button"
                        >
                          Move down
                        </button>
                        <button className={smallButtonClass} onClick={() => removeJournalEntry(entry.id)} type="button">
                          Delete
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-4">
                      <Field label="Entry title" onChange={(value) => updateJournalEntry(entry.id, "title", value)} value={entry.title} />
                      <div className="grid gap-4 sm:grid-cols-3">
                        <Field label="Entry date" onChange={(value) => updateJournalEntry(entry.id, "entryDate", value)} type="date" value={toDateInput(entry.entryDate)} />
                        <Field label="Mood" onChange={(value) => updateJournalEntry(entry.id, "mood", value)} value={entry.mood ?? ""} />
                        <Field label="Weather" onChange={(value) => updateJournalEntry(entry.id, "weatherSummary", value)} value={entry.weatherSummary ?? ""} />
                      </div>
                      <label className="block">
                        <span className="travel-label text-sm font-semibold text-zinc-700">Story photo paired with this wording</span>
                        <select className={inputClass} onChange={(event) => updateJournalEntry(entry.id, "storyPhotoId", event.target.value)} value={entry.storyPhotoId ?? ""}>
                          <option value="">Auto match for old entries</option>
                          {activeTrip.photos.map((photo, photoIndex) => (
                            <option key={photo.id} value={photo.id}>
                              {photoIndex + 1}. {photo.caption ?? photo.originalFilename}
                            </option>
                          ))}
                        </select>
                      </label>
                      <TextArea label="Journal body" onChange={(value) => updateJournalEntry(entry.id, "body", value)} value={entry.body} />
                    </div>
                  </article>
                ))}
              </div>
            </section>
            <section className="mt-8 rounded-xl border border-sky-100 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <SectionTitle eyebrow="Album" title="Trip photos" />
                <span className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-zinc-600">{activeTrip.photos.length} photos</span>
              </div>
              <form className="mt-5 rounded-xl border border-dashed border-sky-200 bg-sky-50/60 p-4" onSubmit={uploadPhoto}>
                <div className="grid gap-4 xl:grid-cols-[minmax(22rem,1.4fr)_minmax(16rem,1fr)_13rem] xl:items-end">
                  <label className="block min-w-0">
                    <span className="travel-label text-sm font-semibold text-zinc-700">Upload photo</span>
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-sky-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white`}
                      name="file"
                      required
                      type="file"
                    />
                  </label>
                  <label className="block min-w-0">
                    <span className="travel-label text-sm font-semibold text-zinc-700">Caption</span>
                    <input className={inputClass} name="caption" placeholder="Snow road outside Rovaniemi" />
                  </label>
                  <label className="block">
                    <span className="travel-label text-sm font-semibold text-zinc-700">Taken at</span>
                    <input className={inputClass} name="takenAt" type="datetime-local" />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-zinc-500">JPG, PNG, or WebP only. Large photos are compressed before upload.</p>
                  <button className={`${primaryButtonClass} min-w-32`} disabled={uploadingTripId === activeTrip.id} type="submit">
                    {uploadingTripId === activeTrip.id ? "Uploading" : "Upload"}
                  </button>
                </div>
              </form>
              {uploadingTripId === activeTrip.id && uploadProgress !== null ? (
                <div className="mt-4 rounded-xl border border-sky-100 bg-white p-3">
                  <div className="h-2 overflow-hidden rounded-full bg-sky-100">
                    <div className="h-full rounded-full bg-sky-700 transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-zinc-600">{uploadProgress}% uploaded</p>
                </div>
              ) : null}
              <div className="mt-5 grid gap-4">
                {activeTrip.photos.map((photo, index) => (
                  <article className="grid gap-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4 lg:grid-cols-[14rem_1fr]" key={photo.id}>
                    <div className="overflow-hidden rounded-xl bg-white">
                      {isRenderablePhoto(photo) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={photo.caption ?? photo.originalFilename} className="h-44 w-full object-cover" src={photo.storageKey} />
                      ) : (
                        <div className="grid h-44 place-items-center text-sm text-zinc-500">Photo pending</div>
                      )}
                    </div>
                    <div className="grid gap-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-700">
                          Photo {index + 1} {photo.id === activeTrip.coverPhotoId ? "/ Cover" : ""}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button className={smallButtonClass} disabled={photo.id === activeTrip.coverPhotoId} onClick={() => setCoverPhoto(photo.id)} type="button">
                            Set cover
                          </button>
                          <button className={smallButtonClass} disabled={index === 0} onClick={() => movePhoto(index, -1)} type="button">
                            Move up
                          </button>
                          <button className={smallButtonClass} disabled={index === activeTrip.photos.length - 1} onClick={() => movePhoto(index, 1)} type="button">
                            Move down
                          </button>
                          <button className={smallButtonClass} onClick={() => removePhoto(photo.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </div>
                      <TextArea label="Caption" onChange={(value) => updatePhoto(photo.id, "caption", value)} value={photo.caption ?? ""} />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field label="Filename" onChange={(value) => updatePhoto(photo.id, "originalFilename", value)} value={photo.originalFilename} />
                        <Field label="Taken at" onChange={(value) => updatePhoto(photo.id, "takenAt", value)} type="datetime-local" value={toDateTimeInput(photo.takenAt)} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </section>
        ) : (
          <section className="rounded-xl border border-sky-100 bg-white/95 p-5 shadow-sm">
            <SectionTitle eyebrow="No trips" title="Nothing to edit yet" />
            <p className="mt-3 text-sm text-zinc-600">Create a new trip draft first.</p>
          </section>
        )}
      </section>
    </main>
  );
}
