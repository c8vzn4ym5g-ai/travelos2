"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { TripDetail } from "@/lib/types";

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

const inputClass =
  "mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-700";

function updateTripValue(trips: TripDetail[], tripId: string, field: keyof TripDetail, value: string) {
  return trips.map((trip) =>
    trip.id === tripId
      ? {
          ...trip,
          [field]: value,
          updatedAt: new Date().toISOString(),
        }
      : trip,
  );
}

export default function AdminPage() {
  const [pin, setPin] = useState("");
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"blob" | "seed">("seed");
  const [message, setMessage] = useState("Loading TravelOS content...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadContent() {
      const response = await fetch("/api/content", { cache: "no-store" });
      const data = (await response.json()) as ContentResponse;
      setTrips(data.content.trips);
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

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <Link className="text-sm font-medium text-zinc-700" href="/trips">
              View public trips
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Admin editor</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Edit TravelOS in the browser</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Update trip records and attach photos without changing project files after the storage variables are connected.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4 text-sm leading-6 text-zinc-600">
              Storage: {configured ? "configured" : "not configured"} / source: {source}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="mb-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <label className="block max-w-md">
            <span className="text-sm font-medium text-zinc-700">Admin PIN</span>
            <input className={inputClass} onChange={(event) => setPin(event.target.value)} type="password" value={pin} />
          </label>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className="rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" disabled={saving} onClick={saveTrips} type="button">
              {saving ? "Saving" : "Save all trip edits"}
            </button>
            <p className="text-sm text-zinc-600">{message}</p>
          </div>
        </div>
        <div className="space-y-5">
          {sortedTrips.map((trip) => (
            <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" key={trip.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                <div className="grid gap-4">
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Title</span>
                    <input className={inputClass} onChange={(event) => setTrips(updateTripValue(trips, trip.id, "title", event.target.value))} value={trip.title} />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-zinc-700">Country</span>
                      <input className={inputClass} onChange={(event) => setTrips(updateTripValue(trips, trip.id, "country", event.target.value))} value={trip.country} />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-zinc-700">City</span>
                      <input className={inputClass} onChange={(event) => setTrips(updateTripValue(trips, trip.id, "city", event.target.value))} value={trip.city} />
                    </label>
                  </div>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Summary</span>
                    <textarea className={`${inputClass} min-h-24`} onChange={(event) => setTrips(updateTripValue(trips, trip.id, "summary", event.target.value))} value={trip.summary} />
                  </label>
                </div>
                <aside className="rounded-md bg-stone-50 p-4">
                  <p className="text-sm font-medium text-zinc-700">Photos</p>
                  <p className="mt-1 text-2xl font-semibold">{trip.photos.length}</p>
                  <form className="mt-4 grid gap-3" onSubmit={(event) => uploadPhoto(event, trip.id)}>
                    <input accept="image/*" className="text-sm" name="file" required type="file" />
                    <input className={inputClass} name="caption" placeholder="Caption" />
                    <input className={inputClass} name="takenAt" type="datetime-local" />
                    <button className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-950" type="submit">
                      Upload photo
                    </button>
                  </form>
                </aside>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
