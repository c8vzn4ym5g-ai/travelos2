"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TravelOSContent } from "@/lib/editable-store";
import {
  appendCapturePhotos,
  attachCaptureJournal,
  buildPrivateCaptureTrip,
  FAMILY_ADMIN_SESSION_KEY,
  isHeicPhoto,
  isProtectedPublicLaplandTrip,
} from "@/lib/family-capture";
import { maxUploadBytes, preparePhotoForUpload } from "@/lib/prepare-photo";
import type { Photo, TripDetail } from "@/lib/types";

type StagedPhoto = {
  file: File;
  id: string;
  previewUrl: string;
};

const controlClass =
  "relative flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-center text-sm font-semibold shadow-sm";
const hiddenFileClass = "absolute inset-0 cursor-pointer opacity-0";

function makeStagedPhotos(files: File[]) {
  return files
    .filter((file) => file.type.startsWith("image/") || isHeicPhoto(file))
    .map((file) => ({
      file,
      id: `staged_${file.name}_${file.size}_${file.lastModified}_${Math.random().toString(36).slice(2, 6)}`,
      previewUrl: URL.createObjectURL(file),
    }));
}

export default function FamilyCapturePage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const photosRef = useRef<StagedPhoto[]>([]);
  const [journalBody, setJournalBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("拍一張或從相簿加入多張照片，再寫下這段旅程。");

  useEffect(() => {
    const storedPin = window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY);
    if (storedPin) {
      setPin(storedPin);
      setAuthenticated(true);
      return;
    }

    router.replace("/family");
  }, [router]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        URL.revokeObjectURL(photo.previewUrl);
      }
    };
  }, []);

  function addIncomingFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const incoming = makeStagedPhotos([...fileList]);
    if (incoming.length === 0) {
      setMessage("請選擇照片。iPhone HEIC 會在這裡轉成 JPEG。");
      return;
    }

    setPhotos((current) => appendCapturePhotos(current, incoming));
    setMessage(`已加入 ${incoming.length} 張照片，可繼續拍照或從相簿再選。`);
  }

  function onTakePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    addIncomingFiles(event.target.files);
    event.target.value = "";
  }

  function onChoosePhotos(event: React.ChangeEvent<HTMLInputElement>) {
    addIncomingFiles(event.target.files);
    event.target.value = "";
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const next = current.filter((photo) => photo.id !== photoId);
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  }

  async function saveMoment() {
    if (!journalBody.trim() && photos.length === 0) {
      setMessage("請先拍照、選照片，或寫下一小段遊記。");
      return;
    }

    setSaving(true);
    setMessage("正在建立私人旅程…");

    try {
      const sessionPin = window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? pin;
      const createdTrip = buildPrivateCaptureTrip({ journalBody });
      if (isProtectedPublicLaplandTrip(createdTrip)) {
        throw new Error("Capture cannot write to the public Lapland trip.");
      }

      const createResponse = await fetch("/api/trips/content", {
        body: JSON.stringify({ trip: createdTrip }),
        headers: {
          "content-type": "application/json",
          "x-travelos-admin-pin": sessionPin,
        },
        method: "POST",
      });

      if (!createResponse.ok) {
        const data = (await createResponse.json()) as { error?: string };
        throw new Error(data.error ?? "Could not create a private trip.");
      }

      const created = (await createResponse.json()) as { trip: TripDetail };
      let trip = created.trip;
      if (isProtectedPublicLaplandTrip(trip)) {
        throw new Error("Capture cannot write to the public Lapland trip.");
      }

      for (const [index, staged] of photos.entries()) {
        setMessage(`正在準備第 ${index + 1} / ${photos.length} 張照片…`);
        const uploadFile = await preparePhotoForUpload(staged.file);
        if (uploadFile.size > maxUploadBytes) {
          throw new Error("Photo is still too large after compression. Please choose a smaller photo.");
        }

        const formData = new FormData();
        formData.set("file", uploadFile);
        formData.set("tripId", trip.id);
        formData.set("caption", staged.file.name);

        const photoResponse = await fetch("/api/trips/photos", {
          body: formData,
          headers: { "x-travelos-admin-pin": sessionPin },
          method: "POST",
        });

        if (!photoResponse.ok) {
          const data = (await photoResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Photo upload failed.");
        }

        const data = (await photoResponse.json()) as { content: TravelOSContent; photo: Photo };
        const updated = data.content.trips.find((item) => item.id === trip.id);
        if (!updated || isProtectedPublicLaplandTrip(updated)) {
          throw new Error("Capture cannot write to the public Lapland trip.");
        }
        trip = updated;
      }

      setMessage("正在寫入遊記…");
      const tripWithJournal = attachCaptureJournal(trip, journalBody);
      if (isProtectedPublicLaplandTrip(tripWithJournal)) {
        throw new Error("Capture cannot write to the public Lapland trip.");
      }

      const saveResponse = await fetch("/api/trips/content", {
        body: JSON.stringify({ trip: tripWithJournal }),
        headers: {
          "content-type": "application/json",
          "x-travelos-admin-pin": sessionPin,
        },
        method: "PUT",
      });

      if (!saveResponse.ok) {
        const data = (await saveResponse.json()) as { error?: string };
        throw new Error(data.error ?? "Journal save failed.");
      }

      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      setPhotos([]);
      setJournalBody("");
      setMessage(`已存成私人旅程：${tripWithJournal.title}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗，請再試一次。");
    } finally {
      setSaving(false);
    }
  }

  if (!authenticated) {
    return (
      <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
        <section className="mx-auto max-w-md px-6 py-8 lg:px-10">
          <div className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
            <p className="travel-label text-sm font-semibold text-emerald-900">正在返回家庭登入…</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">記錄此刻需要同一個家庭密碼，不會另外開密碼表單。</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
      <section className="border-b border-emerald-100 bg-[radial-gradient(circle_at_top_left,_#d1fae5_0,_transparent_34%),linear-gradient(180deg,_#fffdf7_0%,_#f8f3ea_100%)]">
        <div className="mx-auto max-w-xl px-6 py-8 lg:px-10">
          <Link className="travel-label inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800" href="/family">
            ← 家庭入口
          </Link>
          <p className="travel-script mt-8 text-2xl text-rose-700">this moment</p>
          <h1 className="travel-display mt-2 text-4xl font-semibold">記錄此刻</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            拍照或從相簿加入多張照片，再寫一小段遊記。內容會存成新的私人旅程，不會寫進公開的 Lapland 遊記。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-6 py-8 lg:px-10">
        <article className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">照片會一直累加</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">Take Photo / Choose Photos</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">加入之後兩個按鈕都還在，新照片會加進這張卡片，不會覆蓋先前選的。</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className={`${controlClass} border-sky-300 bg-sky-50 text-sky-950`}>
              拍照 / Take Photo
              <input
                accept="image/*"
                capture="environment"
                className={hiddenFileClass}
                onChange={onTakePhoto}
                type="file"
              />
            </label>
            <label className={`${controlClass} border-amber-300 bg-amber-50 text-amber-950`}>
              選照片 / Choose Photos
              <input
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                className={hiddenFileClass}
                multiple
                onChange={onChoosePhotos}
                type="file"
              />
            </label>
          </div>

          {photos.length > 0 ? (
            <ul className="mt-5 grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <li className="relative overflow-hidden rounded-2xl bg-stone-100" key={photo.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt={photo.file.name} className="h-24 w-full object-cover" src={photo.previewUrl} />
                  <button
                    className="absolute right-1 top-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 text-xs font-semibold text-zinc-800"
                    onClick={() => removePhoto(photo.id)}
                    type="button"
                  >
                    移除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-6 text-center text-sm text-zinc-600">
              還沒有照片。先拍照或從相簿選。
            </p>
          )}

          <p className="mt-3 text-xs leading-5 text-zinc-500">{photos.length} photos staged. HEIC converts to JPEG on this phone before upload.</p>

          <label className="mt-6 block">
            <span className="travel-label text-sm font-semibold text-zinc-700">遊記 / Journal</span>
            <textarea
              className="mt-2 min-h-32 w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setJournalBody(event.target.value)}
              placeholder="寫下這一刻。"
              value={journalBody}
            />
          </label>

          <p aria-live="polite" className="mt-3 text-sm leading-6 text-zinc-600">
            {message}
          </p>

          <button
            className="mt-5 min-h-12 w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-950 disabled:opacity-60"
            disabled={saving}
            onClick={saveMoment}
            type="button"
          >
            {saving ? "儲存中…" : "存成私人旅程"}
          </button>
        </article>
      </section>
    </main>
  );
}
