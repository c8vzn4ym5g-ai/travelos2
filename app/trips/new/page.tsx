"use client";

import Link from "next/link";
import { useState } from "react";
import type { CostCategory, PlaceType, TravelVisibility, TripDetail } from "@/lib/types";

const fieldClass =
  "mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-700";
const buttonClass =
  "rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButtonClass = "rounded-md border border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-950";

type DraftState = {
  amount: string;
  city: string;
  costCategory: CostCategory;
  country: string;
  currency: string;
  endDate: string;
  entryBody: string;
  entryTitle: string;
  merchant: string;
  mood: string;
  placeAddress: string;
  placeName: string;
  placeNotes: string;
  placeType: PlaceType;
  rating: string;
  startDate: string;
  summary: string;
  title: string;
  visibility: TravelVisibility;
  weather: string;
};

const initialDraft: DraftState = {
  amount: "",
  city: "",
  costCategory: "hotel",
  country: "",
  currency: "USD",
  endDate: "",
  entryBody: "",
  entryTitle: "",
  merchant: "",
  mood: "",
  placeAddress: "",
  placeName: "",
  placeNotes: "",
  placeType: "hotel",
  rating: "",
  startDate: "",
  summary: "",
  title: "",
  visibility: "private",
  weather: "",
};

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
      .slice(0, 72) || `trip-${Date.now()}`
  );
}

function Field({
  label,
  name,
  onChange,
  placeholder,
  type = "text",
  value,
}: {
  label: string;
  name: keyof DraftState;
  onChange: (name: keyof DraftState, value: string) => void;
  placeholder: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input className={fieldClass} name={name} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  );
}

function SelectField({
  label,
  name,
  onChange,
  options,
  value,
}: {
  label: string;
  name: keyof DraftState;
  onChange: (name: keyof DraftState, value: string) => void;
  options: { label: string; value: string }[];
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select className={fieldClass} name={name} onChange={(event) => onChange(name, event.target.value)} value={value}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({
  label,
  name,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  name: keyof DraftState;
  onChange: (name: keyof DraftState, value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <textarea className={`${fieldClass} min-h-28 leading-6`} name={name} onChange={(event) => onChange(name, event.target.value)} placeholder={placeholder} value={value} />
    </label>
  );
}

function FormSection({
  children,
  kicker,
  title,
}: Readonly<{
  children: React.ReactNode;
  kicker: string;
  title: string;
}>) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase text-teal-700">{kicker}</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-950">{title}</h2>
      <div className="mt-6 grid gap-5">{children}</div>
    </section>
  );
}

function buildTrip(draft: DraftState): TripDetail {
  const now = nowIso();
  const tripId = makeId("trip");
  const title = draft.title.trim();
  const startDate = draft.startDate || now.slice(0, 10);
  const endDate = draft.endDate || startDate;
  const slug = slugify(`${title}-${startDate}`);

  return {
    id: tripId,
    userId: "user_travelos_owner",
    title,
    slug,
    summary: draft.summary.trim(),
    country: draft.country.trim(),
    city: draft.city.trim(),
    startDate,
    endDate,
    coverPhotoId: null,
    visibility: draft.visibility,
    rating: draft.rating ? Number(draft.rating) : null,
    totalCost: draft.amount ? { amount: Number(draft.amount), currency: draft.currency.trim() || "USD" } : null,
    coordinates: null,
    createdAt: now,
    updatedAt: now,
    journalEntries: draft.entryTitle || draft.entryBody
      ? [
          {
            id: makeId("journal"),
            tripId,
            title: draft.entryTitle.trim() || "First memory note",
            body: draft.entryBody.trim() || "Draft note.",
            entryDate: startDate,
            mood: draft.mood.trim() || null,
            weatherSummary: draft.weather.trim() || null,
            aiSummary: null,
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [],
    photos: [],
    places: draft.placeName
      ? [
          {
            id: makeId("place"),
            tripId,
            type: draft.placeType,
            name: draft.placeName.trim(),
            country: draft.country.trim(),
            city: draft.city.trim(),
            address: draft.placeAddress.trim() || null,
            coordinates: null,
            rating: null,
            notes: draft.placeNotes.trim() || null,
            createdAt: now,
            updatedAt: now,
          },
        ]
      : [],
    costs: draft.amount
      ? [
          {
            id: makeId("cost"),
            tripId,
            category: draft.costCategory,
            amount: Number(draft.amount),
            currency: draft.currency.trim() || "USD",
            paidAt: startDate,
            merchant: draft.merchant.trim() || null,
            notes: null,
            createdAt: now,
          },
        ]
      : [],
    musicTracks: [],
  };
}

export default function NewTripPage() {
  const [draft, setDraft] = useState(initialDraft);
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Enter admin PIN to create a saved trip draft.");
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  function updateDraft(name: keyof DraftState, value: string) {
    setDraft((current) => ({ ...current, [name]: value }));
  }

  async function unlockEditor(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Checking admin PIN...");
    const response = await fetch("/api/coffee/admin", {
      headers: { "x-travelos-admin-pin": pin },
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Admin PIN check failed.");
      return;
    }

    setUnlocked(true);
    setMessage("Ready to save Travel drafts.");
  }

  async function saveDraft(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedSlug(null);

    if (!draft.title.trim() || !draft.country.trim() || !draft.city.trim() || !draft.summary.trim()) {
      setMessage("Title, country, city, and summary are required.");
      return;
    }

    setSaving(true);
    setMessage("Saving trip draft...");
    const trip = buildTrip(draft);
    const response = await fetch("/api/trips/content", {
      body: JSON.stringify({ trip }),
      headers: {
        "content-type": "application/json",
        "x-travelos-admin-pin": pin,
      },
      method: "POST",
    });

    setSaving(false);
    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Trip draft save failed.");
      return;
    }

    const data = (await response.json()) as { trip: TripDetail };
    setSavedSlug(data.trip.slug);
    setMessage("Saved. The new trip is now in the Travel list.");
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen bg-stone-50 text-zinc-950">
        <section className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8 lg:px-10">
            <div className="flex items-center justify-between gap-4">
              <Link className="text-sm font-medium text-teal-700" href="/trips">
                Trips
              </Link>
              <span className="rounded-md bg-stone-100 px-3 py-1 text-sm font-medium text-zinc-700">Security first</span>
            </div>
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Trip editor</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Unlock Travel draft editor</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Enter the admin PIN first. The draft form opens only after the code is accepted.</p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-md px-6 py-8 lg:px-10">
          <form className="rounded-lg border border-zinc-200 bg-white p-6" onSubmit={unlockEditor}>
            <Field label="Admin PIN" name="title" onChange={(_, value) => setPin(value)} placeholder="PIN" value={pin} />
            <button className={`${buttonClass} mt-4 w-full`} disabled={!pin.trim()} type="submit">
              Unlock editor
            </button>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{message}</p>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/trips">
              Trips
            </Link>
            <span className="rounded-md bg-stone-100 px-3 py-1 text-sm font-medium text-zinc-700">Saving enabled</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Trip editor</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Create a trip draft</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">Capture the core trip record, first memory note, useful place, and starting cost. Saved drafts appear in Travel immediately.</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-stone-100 p-4 text-sm leading-6 text-zinc-600">{message}</div>
          </div>
        </div>
      </section>
      <form className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10" onSubmit={saveDraft}>
        <div className="space-y-6">
          <FormSection kicker="Overview" title="Trip record">
            <Field label="Trip title" name="title" onChange={updateDraft} placeholder="Autumn rail route through Hokkaido" value={draft.title} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Country" name="country" onChange={updateDraft} placeholder="Japan" value={draft.country} />
              <Field label="City or base" name="city" onChange={updateDraft} placeholder="Sapporo" value={draft.city} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Start date" name="startDate" onChange={updateDraft} placeholder="2026-10-04" type="date" value={draft.startDate} />
              <Field label="End date" name="endDate" onChange={updateDraft} placeholder="2026-10-17" type="date" value={draft.endDate} />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Rating" name="rating" onChange={updateDraft} placeholder="5" type="number" value={draft.rating} />
              <SelectField
                label="Visibility"
                name="visibility"
                onChange={updateDraft}
                options={[
                  { label: "Private", value: "private" },
                  { label: "Shared", value: "shared" },
                  { label: "Public", value: "public" },
                ]}
                value={draft.visibility}
              />
            </div>
            <TextArea label="Summary" name="summary" onChange={updateDraft} placeholder="A concise memory of why this trip matters and what it includes." value={draft.summary} />
          </FormSection>
          <FormSection kicker="Journal" title="First memory note">
            <Field label="Entry title" name="entryTitle" onChange={updateDraft} placeholder="Arrival walk after check-in" value={draft.entryTitle} />
            <TextArea label="Entry body" name="entryBody" onChange={updateDraft} placeholder="Write the first narrative note for this trip." value={draft.entryBody} />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Mood" name="mood" onChange={updateDraft} placeholder="Rested" value={draft.mood} />
              <Field label="Weather" name="weather" onChange={updateDraft} placeholder="Clear and cool" value={draft.weather} />
            </div>
          </FormSection>
        </div>
        <aside className="space-y-6">
          <FormSection kicker="Places" title="First saved place">
            <SelectField
              label="Place type"
              name="placeType"
              onChange={updateDraft}
              options={[
                { label: "Hotel", value: "hotel" },
                { label: "Restaurant", value: "restaurant" },
                { label: "Attraction", value: "attraction" },
                { label: "Airport", value: "airport" },
                { label: "Station", value: "station" },
                { label: "Shopping", value: "shopping" },
                { label: "Other", value: "other" },
              ]}
              value={draft.placeType}
            />
            <Field label="Place name" name="placeName" onChange={updateDraft} placeholder="Sapporo base hotel" value={draft.placeName} />
            <Field label="Address or neighborhood" name="placeAddress" onChange={updateDraft} placeholder="Chuo Ward" value={draft.placeAddress} />
            <Field label="Notes" name="placeNotes" onChange={updateDraft} placeholder="Good transit access; quiet room." value={draft.placeNotes} />
          </FormSection>
          <FormSection kicker="Costs" title="Starting budget item">
            <SelectField
              label="Category"
              name="costCategory"
              onChange={updateDraft}
              options={[
                { label: "Flight", value: "flight" },
                { label: "Hotel", value: "hotel" },
                { label: "Food", value: "food" },
                { label: "Transportation", value: "transportation" },
                { label: "Attraction", value: "attraction" },
                { label: "Shopping", value: "shopping" },
                { label: "Insurance", value: "insurance" },
                { label: "Other", value: "other" },
              ]}
              value={draft.costCategory}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Amount" name="amount" onChange={updateDraft} placeholder="1200" type="number" value={draft.amount} />
              <Field label="Currency" name="currency" onChange={updateDraft} placeholder="USD" value={draft.currency} />
            </div>
            <Field label="Merchant" name="merchant" onChange={updateDraft} placeholder="Hotel or airline" value={draft.merchant} />
          </FormSection>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase text-teal-700">Actions</p>
            <div className="mt-5 grid gap-3">
              <button className={buttonClass} disabled={saving} type="submit">
                {saving ? "Saving" : "Save draft"}
              </button>
              {savedSlug ? (
                <Link className={secondaryButtonClass} href={`/trips/${savedSlug}`}>
                  Open saved trip
                </Link>
              ) : null}
              <Link className={secondaryButtonClass} href="/trips">
                Return to trips
              </Link>
            </div>
          </section>
        </aside>
      </form>
    </main>
  );
}
