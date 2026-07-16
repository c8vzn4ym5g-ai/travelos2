"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TravelOSContent } from "@/lib/editable-store";
import type { TravelVisibility, TripDetail } from "@/lib/types";

type TravelContentResponse = {
  content: TravelOSContent;
  status: {
    configured: boolean;
    source: "blob" | "seed";
  };
};

type TripTextField = "city" | "country" | "slug" | "summary" | "title";
type TripDateField = "endDate" | "startDate";

const adminSessionKey = "travelos-admin-pin";
const inputClass =
  "mt-2 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100";
const textareaClass = `${inputClass} min-h-28 leading-6`;
const primaryButtonClass =
  "travel-label rounded-full border border-sky-300 bg-sky-50 px-5 py-3 text-sm font-semibold text-sky-950 shadow-sm transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60";
const smallButtonClass =
  "travel-label rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40";

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

export default function TravelAdminPage() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"blob" | "seed">("seed");
  const [saving, setSaving] = useState(false);
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
                  <span className="travel-label text-sm font-semibold text-zinc-700">Visibility</span>
                  <select className={inputClass} onChange={(event) => updateVisibility(event.target.value as TravelVisibility)} value={activeTrip.visibility}>
                    <option value="private">Private</option>
                    <option value="shared">Shared</option>
                    <option value="public">Public</option>
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
