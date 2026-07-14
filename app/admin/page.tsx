"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Cost, Money, MusicTrack, Photo, TripDetail, TravelVisibility } from "@/lib/types";

type ContentResponse = {
  content: {
    trips: TripDetail[];
    updatedAt: string;
  };
  status: {
    configured: boolean;
    source: "blob" | "seed";
  };
};

type TripTextField = "city" | "country" | "slug" | "summary" | "title";
type TripDateField = "endDate" | "startDate";
type JournalTextField = "body" | "entryDate" | "mood" | "title" | "weatherSummary";
type PhotoTextField = "caption" | "originalFilename" | "takenAt";
type MusicTextField = "audioUrl" | "title" | "triggerLabel";
type PlaceTextField = "address" | "city" | "country" | "name" | "notes" | "type";
type CostTextField = "category" | "currency" | "merchant" | "notes" | "paidAt";

const inputClass =
  "mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";
const textareaClass = `${inputClass} min-h-28 leading-6`;
const smallButtonClass =
  "rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-teal-700 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40";
const primaryButtonClass =
  "rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 72) || `journey-${Date.now()}`
  );
}

function createDraftTrip(index: number): TripDetail {
  const now = nowIso();
  const startDate = now.slice(0, 10);
  const title = `Journey ${index} draft`;
  const id = makeId("trip");

  return {
    id,
    userId: "user_travelos_owner",
    title,
    slug: slugify(`${title}-${startDate}`),
    summary: "Write a short introduction for this journey. Keep it private until it is ready to share.",
    country: "Country",
    city: "City",
    startDate,
    endDate: startDate,
    coverPhotoId: null,
    visibility: "private",
    rating: null,
    totalCost: { amount: 0, currency: "USD" },
    coordinates: null,
    createdAt: now,
    updatedAt: now,
    journalEntries: [
      {
        id: makeId("journal"),
        tripId: id,
        title: "First memory",
        body: "Write the first section of this travel story here.",
        entryDate: startDate,
        mood: null,
        weatherSummary: null,
        aiSummary: null,
        createdAt: now,
        updatedAt: now,
      },
    ],
    photos: [],
    musicTracks: [],
    places: [],
    costs: [],
  };
}

function toDateInput(value: string | null) {
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

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">{title}</h2>
    </div>
  );
}

function GuideCard() {
  return (
    <section className="rounded-3xl border border-teal-100 bg-[#eef7f3] p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Simple path</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Add Journey 2, 3, 4...</h2>
      <ol className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700">
        <li>
          <span className="font-semibold text-zinc-950">1. Click Add new journey.</span> It starts as Private, so nobody sees it before it is ready.
        </li>
        <li>
          <span className="font-semibold text-zinc-950">2. Fill the Article section.</span> Title, short summary, country, city, dates, and article address.
        </li>
        <li>
          <span className="font-semibold text-zinc-950">3. Write the Journal sections.</span> Use Add section for each chapter of the story. Move up/down changes reading order.
        </li>
        <li>
          <span className="font-semibold text-zinc-950">4. Upload photos.</span> Add captions, choose Set cover for the main image, and move photos into the order you like.
        </li>
        <li>
          <span className="font-semibold text-zinc-950">5. Add music only if you want it.</span> Upload an audio file, set a trigger like Santa Claus Village, and keep volume gentle.
        </li>
        <li>
          <span className="font-semibold text-zinc-950">6. Click Save all edits.</span> Then open the article link and check it like a reader.
        </li>
        <li>
          <span className="font-semibold text-zinc-950">7. Change Visibility to Shared or Public.</span> Save again only when the article looks good.
        </li>
      </ol>
    </section>
  );
}

function Field({
  label,
  onChange,
  type = "text",
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  type?: "date" | "datetime-local" | "number" | "text";
  value: string | number;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input className={inputClass} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <textarea className={textareaClass} onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"blob" | "seed">("seed");
  const [message, setMessage] = useState("Loading TravelOS content...");
  const [saving, setSaving] = useState(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);

  useEffect(() => {
    async function loadContent() {
      const response = await fetch("/api/content", { cache: "no-store" });
      const data = (await response.json()) as ContentResponse;
      const sortedTrips = [...data.content.trips].sort((first, second) => second.startDate.localeCompare(first.startDate));
      setTrips(sortedTrips);
      setActiveTripId((current) => current ?? sortedTrips[0]?.id ?? null);
      setConfigured(data.status.configured);
      setSource(data.status.source);
      setMessage(data.status.configured ? "Ready to edit." : "Storage setup needed before saves work on Vercel.");
    }

    loadContent().catch(() => setMessage("Could not load TravelOS content."));
  }, []);

  const sortedTrips = useMemo(
    () => [...trips].sort((first, second) => second.startDate.localeCompare(first.startDate)),
    [trips],
  );
  const activeTrip = sortedTrips.find((trip) => trip.id === activeTripId) ?? sortedTrips[0] ?? null;

  function updateTrip(tripId: string, updater: (trip: TripDetail) => TripDetail) {
    setTrips((currentTrips) => replaceTrip(currentTrips, tripId, updater));
  }

  function addNewJourney() {
    const draft = createDraftTrip(trips.length + 1);
    setTrips((currentTrips) => [draft, ...currentTrips]);
    setActiveTripId(draft.id);
    setMessage("New private journey draft created. Fill it in, then click Save all edits.");
  }

  function updateTripText(tripId: string, field: TripTextField, value: string) {
    updateTrip(tripId, (trip) => ({ ...trip, [field]: value }));
  }

  function updateTripDate(tripId: string, field: TripDateField, value: string) {
    updateTrip(tripId, (trip) => ({ ...trip, [field]: value }));
  }

  function updateTripVisibility(tripId: string, visibility: TravelVisibility) {
    updateTrip(tripId, (trip) => ({ ...trip, visibility }));
  }

  function updateTripRating(tripId: string, value: string) {
    updateTrip(tripId, (trip) => ({ ...trip, rating: value ? Number(value) : null }));
  }

  function updateTripCost(tripId: string, value: Partial<Money>) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      totalCost: {
        amount: value.amount ?? trip.totalCost?.amount ?? 0,
        currency: value.currency ?? trip.totalCost?.currency ?? "USD",
      },
    }));
  }

  function updateJournal(tripId: string, entryId: string, field: JournalTextField, value: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      journalEntries: trip.journalEntries.map((entry) =>
        entry.id === entryId
          ? {
              ...entry,
              [field]: field === "mood" || field === "weatherSummary" ? value || null : value,
              updatedAt: nowIso(),
            }
          : entry,
      ),
    }));
  }

  function addJournal(tripId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      journalEntries: [
        ...trip.journalEntries,
        {
          id: makeId("journal"),
          tripId,
          title: "New journal section",
          body: "Write the travel memory here.",
          entryDate: trip.startDate,
          mood: null,
          weatherSummary: null,
          aiSummary: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
    }));
  }

  function removeJournal(tripId: string, entryId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      journalEntries: trip.journalEntries.filter((entry) => entry.id !== entryId),
    }));
  }

  function moveJournal(tripId: string, index: number, direction: -1 | 1) {
    updateTrip(tripId, (trip) => ({ ...trip, journalEntries: moveItem(trip.journalEntries, index, direction) }));
  }

  function updatePhoto(tripId: string, photoId: string, field: PhotoTextField, value: string) {
    updateTrip(tripId, (trip) => ({
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

  function setCoverPhoto(tripId: string, photoId: string) {
    updateTrip(tripId, (trip) => ({ ...trip, coverPhotoId: photoId }));
  }

  function removePhoto(tripId: string, photoId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      coverPhotoId: trip.coverPhotoId === photoId ? (trip.photos.find((photo) => photo.id !== photoId)?.id ?? null) : trip.coverPhotoId,
      photos: trip.photos.filter((photo) => photo.id !== photoId),
    }));
  }

  function movePhoto(tripId: string, index: number, direction: -1 | 1) {
    updateTrip(tripId, (trip) => ({ ...trip, photos: moveItem(trip.photos, index, direction) }));
  }

  function updateMusicTrack(tripId: string, musicTrackId: string, field: MusicTextField, value: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      musicTracks: (trip.musicTracks ?? []).map((musicTrack) =>
        musicTrack.id === musicTrackId ? { ...musicTrack, [field]: value } : musicTrack,
      ),
    }));
  }

  function updateMusicVolume(tripId: string, musicTrackId: string, value: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      musicTracks: (trip.musicTracks ?? []).map((musicTrack) =>
        musicTrack.id === musicTrackId ? { ...musicTrack, volume: Math.min(1, Math.max(0, Number(value))) } : musicTrack,
      ),
    }));
  }

  function toggleMusicTrack(tripId: string, musicTrackId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      musicTracks: (trip.musicTracks ?? []).map((musicTrack) =>
        musicTrack.id === musicTrackId ? { ...musicTrack, enabled: !musicTrack.enabled } : musicTrack,
      ),
    }));
  }

  function addMusicUrl(tripId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      musicTracks: [
        {
          id: makeId("music"),
          tripId,
          title: "New music cue",
          audioUrl: "",
          triggerLabel: "Journey",
          volume: 0.32,
          enabled: false,
          createdAt: nowIso(),
        },
        ...(trip.musicTracks ?? []),
      ],
    }));
  }

  function removeMusicTrack(tripId: string, musicTrackId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      musicTracks: (trip.musicTracks ?? []).filter((musicTrack) => musicTrack.id !== musicTrackId),
    }));
  }

  function updatePlace(tripId: string, placeId: string, field: PlaceTextField, value: string) {
    updateTrip(tripId, (trip) => ({
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

  function addPlace(tripId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      places: [
        ...trip.places,
        {
          id: makeId("place"),
          tripId,
          type: "attraction",
          name: "New saved stop",
          country: trip.country,
          city: trip.city,
          address: null,
          coordinates: null,
          rating: null,
          notes: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
      ],
    }));
  }

  function removePlace(tripId: string, placeId: string) {
    updateTrip(tripId, (trip) => ({ ...trip, places: trip.places.filter((place) => place.id !== placeId) }));
  }

  function updateCost(tripId: string, costId: string, field: CostTextField | "amount", value: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      costs: trip.costs.map((cost) =>
        cost.id === costId
          ? {
              ...cost,
              [field]: field === "amount" ? Number(value) : field === "merchant" || field === "notes" ? value || null : value,
            }
          : cost,
      ),
    }));
  }

  function addCost(tripId: string) {
    updateTrip(tripId, (trip) => ({
      ...trip,
      costs: [
        ...trip.costs,
        {
          id: makeId("cost"),
          tripId,
          category: "other",
          amount: 0,
          currency: trip.totalCost?.currency ?? "USD",
          paidAt: trip.startDate,
          merchant: null,
          notes: null,
          createdAt: nowIso(),
        },
      ],
    }));
  }

  function removeCost(tripId: string, costId: string) {
    updateTrip(tripId, (trip) => ({ ...trip, costs: trip.costs.filter((cost) => cost.id !== costId) }));
  }

  async function saveTrips() {
    setSaving(true);
    setMessage("Saving...");
    const response = await fetch("/api/content", {
      body: JSON.stringify({ trips }),
      headers: {
        "content-type": "application/json",
        "x-travelos-admin-pin": pin,
      },
      method: "PUT",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Save failed.");
      setSaving(false);
      return;
    }

    const data = (await response.json()) as ContentResponse;
    setTrips(data.content.trips);
    setMessage("Saved. Public pages will read the updated content.");
    setSaving(false);
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>, tripId: string) {
    event.preventDefault();
    setMessage("Uploading photo...");

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("tripId", tripId);

    const response = await fetch("/api/photos", {
      body: formData,
      headers: {
        "x-travelos-admin-pin": pin,
      },
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Photo upload failed.");
      return;
    }

    const data = (await response.json()) as { content: { trips: TripDetail[] } };
    setTrips(data.content.trips);
    form.reset();
    setMessage("Photo uploaded and attached to the trip.");
  }

  async function uploadMusic(event: React.FormEvent<HTMLFormElement>, tripId: string) {
    event.preventDefault();
    setMessage("Uploading music...");

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("tripId", tripId);

    const response = await fetch("/api/music", {
      body: formData,
      headers: {
        "x-travelos-admin-pin": pin,
      },
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Music upload failed.");
      return;
    }

    const data = (await response.json()) as { content: { trips: TripDetail[] }; musicTrack: MusicTrack };
    setTrips(data.content.trips);
    form.reset();
    setMessage(`Music cue added: ${data.musicTrack.title}`);
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-zinc-950">
      <section className="border-b border-stone-200 bg-white/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-sm font-semibold text-teal-800" href="/">
              TravelOS
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className={smallButtonClass} href="/trips">
                Public trips
              </Link>
              {activeTrip ? (
                <Link className={smallButtonClass} href={`/trips/${activeTrip.slug}`}>
                  Open article
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Admin Editor v2</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Edit the full journey article</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                Update the article, journal sections, saved stops, costs, cover image, photo captions, and album order from one place.
              </p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-zinc-600 shadow-sm">
              <p>Storage: {configured ? "configured" : "not configured"}</p>
              <p>Source: {source}</p>
              <p>Trips loaded: {trips.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_1fr] lg:px-10">
        <aside className="h-fit rounded-3xl border border-stone-200 bg-white/85 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-zinc-800">Journeys</p>
            <button className={smallButtonClass} onClick={addNewJourney} type="button">
              Add new
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-zinc-500">Start every future article here. New journeys stay private until you change Visibility.</p>
          <div className="mt-4 grid gap-2">
            {sortedTrips.map((trip) => (
              <button
                className={`rounded-2xl px-3 py-3 text-left text-sm transition ${
                  trip.id === activeTrip?.id ? "bg-teal-800 text-white" : "bg-stone-50 text-zinc-700 hover:bg-stone-100"
                }`}
                key={trip.id}
                onClick={() => setActiveTripId(trip.id)}
                type="button"
              >
                <span className="block font-semibold">{trip.title}</span>
                <span className={trip.id === activeTrip?.id ? "mt-1 block text-xs text-teal-50" : "mt-1 block text-xs text-zinc-500"}>
                  {trip.city}, {trip.country}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-6">
          <GuideCard />

          <section className="rounded-3xl border border-stone-200 bg-white/90 p-4 shadow-sm sm:p-5">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block max-w-md">
                <span className="text-sm font-medium text-zinc-700">Admin PIN</span>
                <input className={inputClass} onChange={(event) => setPin(event.target.value)} type="password" value={pin} />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button className={primaryButtonClass} disabled={saving || !activeTrip} onClick={saveTrips} type="button">
                  {saving ? "Saving" : "Save all edits"}
                </button>
                <p className="text-sm text-zinc-600">{message}</p>
              </div>
            </div>
          </section>

          {activeTrip ? (
            <>
              <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <SectionTitle eyebrow="Article" title="Overview and publishing" />
                <div className="mt-5 grid gap-4">
                  <Field label="Title" onChange={(value) => updateTripText(activeTrip.id, "title", value)} value={activeTrip.title} />
                  <TextArea label="Summary" onChange={(value) => updateTripText(activeTrip.id, "summary", value)} value={activeTrip.summary} />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Country" onChange={(value) => updateTripText(activeTrip.id, "country", value)} value={activeTrip.country} />
                    <Field label="City" onChange={(value) => updateTripText(activeTrip.id, "city", value)} value={activeTrip.city} />
                    <Field label="Start date" onChange={(value) => updateTripDate(activeTrip.id, "startDate", value)} type="date" value={toDateInput(activeTrip.startDate)} />
                    <Field label="End date" onChange={(value) => updateTripDate(activeTrip.id, "endDate", value)} type="date" value={toDateInput(activeTrip.endDate)} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Article address" onChange={(value) => updateTripText(activeTrip.id, "slug", value)} value={activeTrip.slug} />
                    <label className="block">
                      <span className="text-sm font-medium text-zinc-700">Visibility</span>
                      <select
                        className={inputClass}
                        onChange={(event) => updateTripVisibility(activeTrip.id, event.target.value as TravelVisibility)}
                        value={activeTrip.visibility}
                      >
                        <option value="private">Private</option>
                        <option value="shared">Shared</option>
                        <option value="public">Public</option>
                      </select>
                    </label>
                    <Field label="Rating" onChange={(value) => updateTripRating(activeTrip.id, value)} type="number" value={activeTrip.rating ?? ""} />
                    <Field label="Total cost" onChange={(value) => updateTripCost(activeTrip.id, { amount: Number(value) })} type="number" value={activeTrip.totalCost?.amount ?? 0} />
                  </div>
                  <div className="rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-zinc-600">
                    Keep Visibility as Private while drafting. The article address becomes the public URL after `/trips/`, so use simple English words with hyphens.
                  </div>
                  <Field label="Currency" onChange={(value) => updateTripCost(activeTrip.id, { currency: value })} value={activeTrip.totalCost?.currency ?? "USD"} />
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle eyebrow="Writing" title="Journal sections" />
                  <button className={smallButtonClass} onClick={() => addJournal(activeTrip.id)} type="button">
                    Add section
                  </button>
                </div>
                <div className="mt-5 space-y-4">
                  {activeTrip.journalEntries.map((entry, index) => (
                    <article className="rounded-3xl border border-stone-200 bg-stone-50 p-4" key={entry.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-700">Section {index + 1}</p>
                        <div className="flex flex-wrap gap-2">
                          <button className={smallButtonClass} disabled={index === 0} onClick={() => moveJournal(activeTrip.id, index, -1)} type="button">
                            Move up
                          </button>
                          <button className={smallButtonClass} disabled={index === activeTrip.journalEntries.length - 1} onClick={() => moveJournal(activeTrip.id, index, 1)} type="button">
                            Move down
                          </button>
                          <button className={smallButtonClass} onClick={() => removeJournal(activeTrip.id, entry.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <Field label="Section title" onChange={(value) => updateJournal(activeTrip.id, entry.id, "title", value)} value={entry.title} />
                        <TextArea label="Body" onChange={(value) => updateJournal(activeTrip.id, entry.id, "body", value)} value={entry.body} />
                        <div className="grid gap-4 sm:grid-cols-3">
                          <Field label="Entry date" onChange={(value) => updateJournal(activeTrip.id, entry.id, "entryDate", value)} type="date" value={toDateInput(entry.entryDate)} />
                          <Field label="Mood" onChange={(value) => updateJournal(activeTrip.id, entry.id, "mood", value)} value={entry.mood ?? ""} />
                          <Field label="Weather" onChange={(value) => updateJournal(activeTrip.id, entry.id, "weatherSummary", value)} value={entry.weatherSummary ?? ""} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle eyebrow="Album" title="Photos, captions, and cover" />
                  <span className="rounded-full bg-stone-100 px-3 py-2 text-xs font-semibold text-zinc-600">{activeTrip.photos.length} photos</span>
                </div>
                <form className="mt-5 grid gap-3 rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-4 lg:grid-cols-[1fr_1fr_13rem_auto] lg:items-end" onSubmit={(event) => uploadPhoto(event, activeTrip.id)}>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Upload photo</span>
                    <input accept="image/*" className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-teal-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white`} name="file" required type="file" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Caption</span>
                    <input className={inputClass} name="caption" placeholder="Short caption for the new photo" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Taken at</span>
                    <input className={inputClass} name="takenAt" type="datetime-local" />
                  </label>
                  <button className={primaryButtonClass} type="submit">
                    Upload
                  </button>
                </form>
                <div className="mt-5 grid gap-4">
                  {activeTrip.photos.map((photo, index) => (
                    <article className="grid gap-4 rounded-3xl border border-stone-200 bg-stone-50 p-4 lg:grid-cols-[14rem_1fr]" key={photo.id}>
                      <div className="overflow-hidden rounded-2xl bg-white">
                        {isRenderablePhoto(photo) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img alt={photo.caption ?? photo.originalFilename} className="h-44 w-full object-cover" src={photo.storageKey} />
                        ) : (
                          <div className="grid h-44 place-items-center text-sm text-zinc-500">Photo pending</div>
                        )}
                      </div>
                      <div className="grid gap-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-zinc-700">{activeTrip.coverPhotoId === photo.id ? "Cover photo" : `Photo ${index + 1}`}</p>
                          <div className="flex flex-wrap gap-2">
                            <button className={smallButtonClass} disabled={index === 0} onClick={() => movePhoto(activeTrip.id, index, -1)} type="button">
                              Move up
                            </button>
                            <button className={smallButtonClass} disabled={index === activeTrip.photos.length - 1} onClick={() => movePhoto(activeTrip.id, index, 1)} type="button">
                              Move down
                            </button>
                            <button className={smallButtonClass} onClick={() => setCoverPhoto(activeTrip.id, photo.id)} type="button">
                              Set cover
                            </button>
                            <button className={smallButtonClass} onClick={() => removePhoto(activeTrip.id, photo.id)} type="button">
                              Delete
                            </button>
                          </div>
                        </div>
                        <TextArea label="Caption" onChange={(value) => updatePhoto(activeTrip.id, photo.id, "caption", value)} value={photo.caption ?? ""} />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Filename" onChange={(value) => updatePhoto(activeTrip.id, photo.id, "originalFilename", value)} value={photo.originalFilename} />
                          <Field label="Taken at" onChange={(value) => updatePhoto(activeTrip.id, photo.id, "takenAt", value)} type="datetime-local" value={toDateTimeInput(photo.takenAt)} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle eyebrow="Music" title="Gentle journey soundtrack" />
                  <button className={smallButtonClass} onClick={() => addMusicUrl(activeTrip.id)} type="button">
                    Add URL cue
                  </button>
                </div>
                <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-3 text-sm leading-6 text-zinc-600">
                  Music starts only after the visitor taps Play music. Use music you own, licensed music, or public-domain audio. For Santa photos or sections, use trigger label: Santa Claus Village.
                </div>
                <form className="mt-5 grid gap-3 rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-4 lg:grid-cols-[1fr_1fr_12rem_8rem_7rem] lg:items-end" onSubmit={(event) => uploadMusic(event, activeTrip.id)}>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Music file</span>
                    <input accept="audio/*" className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-teal-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white`} name="file" type="file" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Or audio URL</span>
                    <input className={inputClass} name="audioUrl" placeholder="https://..." />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Title</span>
                    <input className={inputClass} name="title" placeholder="Christmas in Lapland" required />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Trigger</span>
                    <input className={inputClass} name="triggerLabel" placeholder="Santa Claus Village" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Volume</span>
                    <input className={inputClass} defaultValue="0.32" max="1" min="0" name="volume" step="0.05" type="number" />
                  </label>
                  <button className={primaryButtonClass} type="submit">
                    Add music
                  </button>
                </form>
                <div className="mt-5 grid gap-4">
                  {(activeTrip.musicTracks ?? []).map((musicTrack) => (
                    <article className="rounded-3xl border border-stone-200 bg-stone-50 p-4" key={musicTrack.id}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-zinc-700">{musicTrack.enabled ? "Enabled" : "Disabled"}</p>
                        <div className="flex flex-wrap gap-2">
                          <button className={smallButtonClass} onClick={() => toggleMusicTrack(activeTrip.id, musicTrack.id)} type="button">
                            {musicTrack.enabled ? "Disable" : "Enable"}
                          </button>
                          <button className={smallButtonClass} onClick={() => removeMusicTrack(activeTrip.id, musicTrack.id)} type="button">
                            Delete
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4">
                        <Field label="Music title" onChange={(value) => updateMusicTrack(activeTrip.id, musicTrack.id, "title", value)} value={musicTrack.title} />
                        <Field label="Audio URL" onChange={(value) => updateMusicTrack(activeTrip.id, musicTrack.id, "audioUrl", value)} value={musicTrack.audioUrl} />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Trigger label" onChange={(value) => updateMusicTrack(activeTrip.id, musicTrack.id, "triggerLabel", value)} value={musicTrack.triggerLabel} />
                          <Field label="Volume 0-1" onChange={(value) => updateMusicVolume(activeTrip.id, musicTrack.id, value)} type="number" value={musicTrack.volume} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionTitle eyebrow="Places" title="Saved stops" />
                    <button className={smallButtonClass} onClick={() => addPlace(activeTrip.id)} type="button">
                      Add stop
                    </button>
                  </div>
                  <div className="mt-5 space-y-4">
                    {activeTrip.places.map((place) => (
                      <article className="rounded-3xl border border-stone-200 bg-stone-50 p-4" key={place.id}>
                        <div className="flex justify-end">
                          <button className={smallButtonClass} onClick={() => removePlace(activeTrip.id, place.id)} type="button">
                            Delete
                          </button>
                        </div>
                        <div className="mt-3 grid gap-4">
                          <Field label="Name" onChange={(value) => updatePlace(activeTrip.id, place.id, "name", value)} value={place.name} />
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Type" onChange={(value) => updatePlace(activeTrip.id, place.id, "type", value)} value={place.type} />
                            <Field label="City" onChange={(value) => updatePlace(activeTrip.id, place.id, "city", value)} value={place.city} />
                          </div>
                          <TextArea label="Notes" onChange={(value) => updatePlace(activeTrip.id, place.id, "notes", value)} value={place.notes ?? ""} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <SectionTitle eyebrow="Costs" title="Tracked spend" />
                    <button className={smallButtonClass} onClick={() => addCost(activeTrip.id)} type="button">
                      Add cost
                    </button>
                  </div>
                  <div className="mt-5 space-y-4">
                    {activeTrip.costs.map((cost: Cost) => (
                      <article className="rounded-3xl border border-stone-200 bg-stone-50 p-4" key={cost.id}>
                        <div className="flex justify-end">
                          <button className={smallButtonClass} onClick={() => removeCost(activeTrip.id, cost.id)} type="button">
                            Delete
                          </button>
                        </div>
                        <div className="mt-3 grid gap-4">
                          <div className="grid gap-4 sm:grid-cols-3">
                            <Field label="Category" onChange={(value) => updateCost(activeTrip.id, cost.id, "category", value)} value={cost.category} />
                            <Field label="Amount" onChange={(value) => updateCost(activeTrip.id, cost.id, "amount", value)} type="number" value={cost.amount} />
                            <Field label="Currency" onChange={(value) => updateCost(activeTrip.id, cost.id, "currency", value)} value={cost.currency} />
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <Field label="Paid date" onChange={(value) => updateCost(activeTrip.id, cost.id, "paidAt", value)} type="date" value={toDateInput(cost.paidAt)} />
                            <Field label="Merchant" onChange={(value) => updateCost(activeTrip.id, cost.id, "merchant", value)} value={cost.merchant ?? ""} />
                          </div>
                          <TextArea label="Notes" onChange={(value) => updateCost(activeTrip.id, cost.id, "notes", value)} value={cost.notes ?? ""} />
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-stone-200 bg-white/90 p-6 text-sm text-zinc-600 shadow-sm">
              No trips are available yet.
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
