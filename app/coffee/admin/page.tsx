"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { CoffeeMood, CoffeePhoto, CoffeeShop } from "@/lib/types";

type CoffeeContentResponse = {
  content: {
    shops: CoffeeShop[];
    updatedAt: string;
  };
  status: {
    configured: boolean;
    source: "blob" | "seed";
  };
};

type CoffeeTextField =
  | "address"
  | "city"
  | "coffeeOrdered"
  | "comments"
  | "country"
  | "lifeNote"
  | "mapUrl"
  | "name"
  | "slug"
  | "websiteUrl";
type CoffeeDateField = "visitedAt";
type CoffeePhotoTextField = "caption" | "originalFilename" | "takenAt";

const inputClass =
  "mt-2 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-zinc-950 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100";
const textareaClass = `${inputClass} min-h-28 leading-6`;
const smallButtonClass =
  "rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:border-teal-700 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-40";
const primaryButtonClass =
  "rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60";
const supportedUploadTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxUploadBytes = 4_500_000;

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
      .slice(0, 72) || `coffee-${Date.now()}`
  );
}

function createDraftCoffeeShop(index: number): CoffeeShop {
  const now = nowIso();
  const visitedAt = now.slice(0, 10);
  const name = `Coffee shop ${index}`;
  const id = makeId("coffee");

  return {
    id,
    userId: "user_travelos_owner",
    name,
    slug: slugify(`${name}-${visitedAt}`),
    country: "Country",
    city: "City",
    address: "Paste address here",
    mapUrl: null,
    websiteUrl: null,
    visitedAt,
    coffeeOrdered: "Coffee order",
    rating: null,
    mood: "reflective",
    tags: ["new"],
    comments: "Taste, service, seat, music, laptop-friendliness, view, or anything practical.",
    lifeNote: "What happened in your life here? What did this coffee moment mean?",
    linkedTripId: null,
    coordinates: null,
    photos: [],
    createdAt: now,
    updatedAt: now,
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

function isRenderablePhoto(photo: CoffeePhoto) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
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

    const filename = file.name.replace(/\.[^.]+$/, "") || "coffee-photo";
    return new File([blob], `${filename}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function uploadCoffeePhotoWithProgress(
  formData: FormData,
  pin: string,
  onProgress: (progress: number) => void,
): Promise<{ content: { shops: CoffeeShop[] }; photo: CoffeePhoto }> {
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
      const data = JSON.parse(xhr.responseText || "{}") as { content?: { shops: CoffeeShop[] }; error?: string; photo?: CoffeePhoto };

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

    xhr.open("POST", "/api/coffee/photos");
    xhr.setRequestHeader("x-travelos-admin-pin", pin);
    xhr.send(formData);
  });
}

function replaceShop(shops: CoffeeShop[], shopId: string, updater: (shop: CoffeeShop) => CoffeeShop) {
  return shops.map((shop) =>
    shop.id === shopId
      ? {
          ...updater(shop),
          updatedAt: nowIso(),
        }
      : shop,
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
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Coffee admin guide</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950">Add cafes while the memory is fresh</h2>
      <ol className="mt-4 grid gap-3 text-sm leading-6 text-zinc-700">
        <li><span className="font-semibold text-zinc-950">1. Click Add coffee shop.</span> Start with the shop name, city, address, and map link.</li>
        <li><span className="font-semibold text-zinc-950">2. Write comments separately from life notes.</span> Comments are practical; life notes are what happened to you there.</li>
        <li><span className="font-semibold text-zinc-950">3. Add tags.</span> Use simple comma-separated tags like quiet, laptop-friendly, best latte.</li>
        <li><span className="font-semibold text-zinc-950">4. Upload photos.</span> Add cup, storefront, menu, table, or receipt images with short captions.</li>
        <li><span className="font-semibold text-zinc-950">5. Click Save all edits.</span> Then open the public note and check it like a reader.</li>
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
  type?: "date" | "datetime-local" | "number" | "text" | "url";
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

export default function CoffeeAdminPage() {
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);
  const [shops, setShops] = useState<CoffeeShop[]>([]);
  const [configured, setConfigured] = useState(false);
  const [source, setSource] = useState<"blob" | "seed">("seed");
  const [message, setMessage] = useState("Enter admin PIN to edit coffee content.");
  const [saving, setSaving] = useState(false);
  const [uploadingShopId, setUploadingShopId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);

  async function loadContent() {
    setMessage("Loading coffee content...");
    const response = await fetch("/api/coffee/content", { cache: "no-store" });
    const data = (await response.json()) as CoffeeContentResponse;
    const sortedShops = [...data.content.shops].sort((first, second) => second.visitedAt.localeCompare(first.visitedAt));
    setShops(sortedShops);
    setActiveShopId((current) => current ?? sortedShops[0]?.id ?? null);
    setConfigured(data.status.configured);
    setSource(data.status.source);
    setMessage(data.status.configured ? "Ready to edit." : "Storage setup needed before saves work on Vercel.");
  }

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    loadContent().catch(() => setMessage("Could not load coffee content."));
  }, [authenticated]);

  async function verifyPin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckingPin(true);
    setMessage("Checking admin PIN...");

    const response = await fetch("/api/coffee/admin", {
      headers: {
        "x-travelos-admin-pin": pin,
      },
      method: "POST",
    });

    if (!response.ok) {
      const data = (await response.json()) as { error?: string };
      setMessage(data.error ?? "Admin PIN check failed.");
      setCheckingPin(false);
      return;
    }

    setAuthenticated(true);
    setCheckingPin(false);
  }

  const sortedShops = useMemo(
    () => [...shops].sort((first, second) => second.visitedAt.localeCompare(first.visitedAt)),
    [shops],
  );
  const activeShop = sortedShops.find((shop) => shop.id === activeShopId) ?? sortedShops[0] ?? null;

  if (!authenticated) {
    return (
      <main className="min-h-screen bg-[#f7f2ea] text-zinc-950">
        <section className="border-b border-stone-200 bg-white/85">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link className="text-sm font-semibold text-teal-800" href="/coffee">
                Coffee Map
              </Link>
              <Link className={smallButtonClass} href="/coffee">
                Public coffee
              </Link>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Coffee Admin</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Security check</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Enter the admin PIN first. The editing workspace opens only after the code is accepted.
              </p>
            </div>
          </div>
        </section>
        <section className="mx-auto max-w-md px-4 py-8 sm:px-6 lg:px-10">
          <form className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm" onSubmit={verifyPin}>
            <SectionTitle eyebrow="Security" title="Admin PIN" />
            <Field label="PIN" onChange={setPin} value={pin} />
            <button className={`${primaryButtonClass} mt-4 w-full`} disabled={checkingPin || pin.trim().length === 0} type="submit">
              {checkingPin ? "Checking" : "Unlock editor"}
            </button>
            <p className="mt-4 text-sm leading-6 text-zinc-600">{message}</p>
          </form>
        </section>
      </main>
    );
  }

  function updateShop(shopId: string, updater: (shop: CoffeeShop) => CoffeeShop) {
    setShops((currentShops) => replaceShop(currentShops, shopId, updater));
  }

  function addNewCoffeeShop() {
    const draft = createDraftCoffeeShop(shops.length + 1);
    setShops((currentShops) => [draft, ...currentShops]);
    setActiveShopId(draft.id);
    setMessage("New coffee shop draft created. Fill it in, then click Save all edits.");
  }

  function updateText(shopId: string, field: CoffeeTextField, value: string) {
    updateShop(shopId, (shop) => ({ ...shop, [field]: value || (field === "mapUrl" || field === "websiteUrl" ? null : "") }));
  }

  function updateDate(shopId: string, field: CoffeeDateField, value: string) {
    updateShop(shopId, (shop) => ({ ...shop, [field]: value }));
  }

  function updateRating(shopId: string, value: string) {
    updateShop(shopId, (shop) => ({ ...shop, rating: value ? Number(value) : null }));
  }

  function updateMood(shopId: string, mood: CoffeeMood) {
    updateShop(shopId, (shop) => ({ ...shop, mood }));
  }

  function updateTags(shopId: string, value: string) {
    updateShop(shopId, (shop) => ({
      ...shop,
      tags: value
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    }));
  }

  function updatePhoto(shopId: string, photoId: string, field: CoffeePhotoTextField, value: string) {
    updateShop(shopId, (shop) => ({
      ...shop,
      photos: shop.photos.map((photo) =>
        photo.id === photoId
          ? {
              ...photo,
              [field]: field === "caption" ? value || null : field === "takenAt" ? fromDateTimeInput(value) : value,
            }
          : photo,
      ),
    }));
  }

  function removePhoto(shopId: string, photoId: string) {
    updateShop(shopId, (shop) => ({
      ...shop,
      photos: shop.photos.filter((photo) => photo.id !== photoId),
    }));
  }

  function movePhoto(shopId: string, index: number, direction: -1 | 1) {
    updateShop(shopId, (shop) => ({ ...shop, photos: moveItem(shop.photos, index, direction) }));
  }

  async function saveShops() {
    setSaving(true);
    setMessage("Saving...");
    const response = await fetch("/api/coffee/content", {
      body: JSON.stringify({ shops }),
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

    const data = (await response.json()) as CoffeeContentResponse;
    setShops(data.content.shops);
    setMessage("Saved. Public coffee pages will read the updated content.");
    setSaving(false);
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>, coffeeShopId: string) {
    event.preventDefault();
    setUploadingShopId(coffeeShopId);
    setUploadProgress(null);
    setMessage("Preparing selected photo...");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const selectedFile = formData.get("file");

    if (!(selectedFile instanceof File)) {
      setMessage("Choose a photo file first.");
      setUploadingShopId(null);
      return;
    }

    try {
      const uploadFile = await resizePhotoForUpload(selectedFile);
      if (uploadFile.size > maxUploadBytes) {
        setMessage("Photo is still too large after compression. Please choose a smaller JPG, PNG, or WebP photo.");
        return;
      }

      formData.set("file", uploadFile);
      formData.set("coffeeShopId", coffeeShopId);
      setMessage(
        uploadFile.size < selectedFile.size
          ? `Photo compressed to ${(uploadFile.size / 1_000_000).toFixed(1)} MB. Saving coffee record...`
          : "Saving coffee record before photo upload...",
      );

      const saveResponse = await fetchWithTimeout(
        "/api/coffee/content",
        {
          body: JSON.stringify({ shops }),
          headers: {
            "content-type": "application/json",
            "x-travelos-admin-pin": pin,
          },
          method: "PUT",
        },
        30000,
      );

      if (!saveResponse.ok) {
        const data = (await saveResponse.json()) as { error?: string };
        setMessage(data.error ?? "Save before photo upload failed.");
        return;
      }

      setUploadProgress(0);
      setMessage("Uploading coffee photo: 0%");

      const data = await uploadCoffeePhotoWithProgress(formData, pin, (progress) => {
        setUploadProgress(progress);
        setMessage(`Uploading coffee photo: ${progress}%`);
      });
      const uploadedPhoto = data.photo;
      const nextShops = data.content.shops.map((shop) =>
        shop.id === coffeeShopId && !shop.photos.some((photo) => photo.id === uploadedPhoto.id)
          ? { ...shop, photos: [uploadedPhoto, ...shop.photos], updatedAt: nowIso() }
          : shop,
      );
      const savedShop = nextShops.find((shop) => shop.id === coffeeShopId);

      setShops(nextShops);
      form.reset();
      setMessage(
        savedShop?.photos.some((photo) => photo.id === data.photo.id)
          ? `Photo uploaded: ${data.photo.originalFilename}`
          : "Photo uploaded, but the saved record did not refresh. Please try Upload again.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : error instanceof DOMException && error.name === "AbortError"
            ? "Photo upload timed out. Try a smaller photo."
            : "Photo upload failed. Try another image.",
      );
    } finally {
      setUploadingShopId(null);
      setUploadProgress(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f2ea] text-zinc-950">
      <section className="border-b border-stone-200 bg-white/85">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-sm font-semibold text-teal-800" href="/coffee">
              Coffee Map
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className={smallButtonClass} href="/coffee">
                Public coffee
              </Link>
              {activeShop ? (
                <Link className={smallButtonClass} href={`/coffee/${activeShop.slug}`}>
                  Open note
                </Link>
              ) : null}
            </div>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_22rem] lg:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-800">Coffee Admin</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Edit coffee notes and photos</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-600">
                Add cafes, paste addresses and map links, write comments, record life notes, and upload coffee photos.
              </p>
            </div>
            <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4 text-sm leading-6 text-zinc-600 shadow-sm">
              <p>Storage: {configured ? "configured" : "not configured"}</p>
              <p>Source: {source}</p>
              <p>{message}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[20rem_1fr] lg:px-10">
        <aside className="space-y-5">
          <GuideCard />
          <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <SectionTitle eyebrow="Security" title="Unlocked editor" />
            <p className="mt-3 text-sm leading-6 text-zinc-600">Admin PIN accepted. Saves and photo uploads will use this session.</p>
            <button className={`${primaryButtonClass} mt-4 w-full`} onClick={addNewCoffeeShop} type="button">
              Add coffee shop
            </button>
          </section>
          <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
            <SectionTitle eyebrow="Records" title="Coffee shops" />
            <div className="mt-4 grid gap-2">
              {sortedShops.map((shop) => (
                <button
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    activeShop?.id === shop.id ? "border-teal-700 bg-teal-50 text-teal-950" : "border-stone-200 bg-white text-zinc-700"
                  }`}
                  key={shop.id}
                  onClick={() => setActiveShopId(shop.id)}
                  type="button"
                >
                  <span className="block font-semibold">{shop.name}</span>
                  <span className="mt-1 block text-xs">{shop.city}, {shop.country}</span>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <div className="space-y-6">
          <section className="sticky top-0 z-10 rounded-3xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center gap-3">
              <button className={primaryButtonClass} disabled={saving || !activeShop} onClick={saveShops} type="button">
                {saving ? "Saving" : "Save all edits"}
              </button>
              <p className="text-sm text-zinc-600">{message}</p>
            </div>
          </section>

          {activeShop ? (
            <>
              <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <SectionTitle eyebrow="Place" title="Coffee shop details" />
                <div className="mt-5 grid gap-4">
                  <Field label="Shop name" onChange={(value) => updateText(activeShop.id, "name", value)} value={activeShop.name} />
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Field label="Country" onChange={(value) => updateText(activeShop.id, "country", value)} value={activeShop.country} />
                    <Field label="City" onChange={(value) => updateText(activeShop.id, "city", value)} value={activeShop.city} />
                    <Field label="Visit date" onChange={(value) => updateDate(activeShop.id, "visitedAt", value)} type="date" value={toDateInput(activeShop.visitedAt)} />
                    <Field label="Rating" onChange={(value) => updateRating(activeShop.id, value)} type="number" value={activeShop.rating ?? ""} />
                  </div>
                  <Field label="Address" onChange={(value) => updateText(activeShop.id, "address", value)} value={activeShop.address} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Map link" onChange={(value) => updateText(activeShop.id, "mapUrl", value)} type="url" value={activeShop.mapUrl ?? ""} />
                    <Field label="Website link" onChange={(value) => updateText(activeShop.id, "websiteUrl", value)} type="url" value={activeShop.websiteUrl ?? ""} />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Coffee ordered" onChange={(value) => updateText(activeShop.id, "coffeeOrdered", value)} value={activeShop.coffeeOrdered} />
                    <Field label="Coffee note address" onChange={(value) => updateText(activeShop.id, "slug", value)} value={activeShop.slug} />
                    <label className="block">
                      <span className="text-sm font-medium text-zinc-700">Mood</span>
                      <select className={inputClass} onChange={(event) => updateMood(activeShop.id, event.target.value as CoffeeMood)} value={activeShop.mood}>
                        {["focused", "quiet", "social", "reflective", "inspired", "tired", "other"].map((mood) => (
                          <option key={mood} value={mood}>{mood}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <SectionTitle eyebrow="Memory" title="Comments and life notes" />
                <div className="mt-5 grid gap-4">
                  <TextArea label="Comments" onChange={(value) => updateText(activeShop.id, "comments", value)} value={activeShop.comments} />
                  <TextArea label="Life note" onChange={(value) => updateText(activeShop.id, "lifeNote", value)} value={activeShop.lifeNote} />
                  <Field label="Tags, comma separated" onChange={(value) => updateTags(activeShop.id, value)} value={activeShop.tags.join(", ")} />
                </div>
              </section>

              <section className="rounded-3xl border border-stone-200 bg-white/90 p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <SectionTitle eyebrow="Album" title="Coffee photos" />
                  <span className="rounded-full bg-stone-100 px-3 py-2 text-xs font-semibold text-zinc-600">{activeShop.photos.length} photos</span>
                </div>
                <form className="mt-5 grid gap-3 rounded-3xl border border-dashed border-stone-300 bg-stone-50 p-4 lg:grid-cols-[1fr_1fr_13rem_auto] lg:items-end" onSubmit={(event) => uploadPhoto(event, activeShop.id)}>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Upload photo</span>
                    <input accept="image/jpeg,image/png,image/webp" className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-teal-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white`} name="file" required type="file" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Caption</span>
                    <input className={inputClass} name="caption" placeholder="Cup by the window" />
                  </label>
                  <label className="block">
                    <span className="text-sm font-medium text-zinc-700">Taken at</span>
                    <input className={inputClass} name="takenAt" type="datetime-local" />
                  </label>
                  <button className={primaryButtonClass} disabled={uploadingShopId === activeShop.id} type="submit">
                    {uploadingShopId === activeShop.id ? "Uploading" : "Upload"}
                  </button>
                </form>
                {uploadingShopId === activeShop.id && uploadProgress !== null ? (
                  <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-3">
                    <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                      <div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="mt-2 text-xs font-semibold text-zinc-600">{uploadProgress}% uploaded</p>
                  </div>
                ) : null}
                <div className="mt-5 grid gap-4">
                  {activeShop.photos.map((photo, index) => (
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
                          <p className="text-sm font-semibold text-zinc-700">Photo {index + 1}</p>
                          <div className="flex flex-wrap gap-2">
                            <button className={smallButtonClass} disabled={index === 0} onClick={() => movePhoto(activeShop.id, index, -1)} type="button">
                              Move up
                            </button>
                            <button className={smallButtonClass} disabled={index === activeShop.photos.length - 1} onClick={() => movePhoto(activeShop.id, index, 1)} type="button">
                              Move down
                            </button>
                            <button className={smallButtonClass} onClick={() => removePhoto(activeShop.id, photo.id)} type="button">
                              Delete
                            </button>
                          </div>
                        </div>
                        <TextArea label="Caption" onChange={(value) => updatePhoto(activeShop.id, photo.id, "caption", value)} value={photo.caption ?? ""} />
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field label="Filename" onChange={(value) => updatePhoto(activeShop.id, photo.id, "originalFilename", value)} value={photo.originalFilename} />
                          <Field label="Taken at" onChange={(value) => updatePhoto(activeShop.id, photo.id, "takenAt", value)} type="datetime-local" value={toDateTimeInput(photo.takenAt)} />
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <section className="rounded-3xl border border-stone-200 bg-white/90 p-6 text-sm text-zinc-600 shadow-sm">
              No coffee shops are available yet.
            </section>
          )}
        </div>
      </section>
    </main>
  );
}
