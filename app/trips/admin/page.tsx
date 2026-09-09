"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShortVideoGallery } from "@/components/short-video-gallery";
import type { TravelOSContent } from "@/lib/editable-store";
import { getTripPromoVideos } from "@/lib/promo-videos";
import { isTripPublic } from "@/lib/trip-visibility";
import type { JournalEntry, Photo, TravelVisibility, TripDetail } from "@/lib/types";

type TravelContentResponse = {
  content: TravelOSContent;
  status: { configured: boolean; source: "blob" | "drive" | "seed" };
};
type EditorTab = "story" | "photos" | "videos" | "details";
type PickerTarget = { kind: "new" } | { kind: "journal"; entryId: string } | null;

const inputClass =
  "mt-2 min-h-11 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-base text-zinc-950 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100";
const primaryButtonClass =
  "travel-label inline-flex min-h-11 items-center justify-center rounded-full bg-sky-800 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-900 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "travel-label inline-flex min-h-11 items-center justify-center rounded-full border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-900 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40";

const tabs: Array<{ id: EditorTab; label: string }> = [
  { id: "story", label: "看草稿・寫感想" },
  { id: "photos", label: "照片" },
  { id: "videos", label: "短片" },
  { id: "details", label: "行程資料" },
];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function toDateInput(value: string) {
  return value ? value.slice(0, 10) : "";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "時間尚未整理";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function photoLabel(photo: Photo, index: number) {
  return photo.caption?.trim() || photo.originalFilename || `照片 ${index + 1}`;
}

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function photoTime(photo: Photo) {
  const time = Date.parse(photo.takenAt ?? "");
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function PhotoThumb({ photo, className = "h-28" }: { photo: Photo; className?: string }) {
  if (!isRenderablePhoto(photo)) {
    return <div className={`${className} grid w-full place-items-center bg-stone-100 text-sm text-zinc-500`}>照片整理中</div>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={photo.caption ?? photo.originalFilename} className={`${className} w-full object-cover`} src={photo.storageKey} />
  );
}

function Field({ label, onChange, type = "text", value }: { label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="block">
      <span className="travel-label text-sm font-semibold text-zinc-700">{label}</span>
      <input className={inputClass} onChange={(event) => onChange(event.target.value)} type={type} value={value} />
    </label>
  );
}

function uploadTripPhotoWithProgress(formData: FormData, onProgress: (progress: number) => void) {
  return new Promise<{ content: TravelOSContent; photo: Photo }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const timeout = window.setTimeout(() => {
      xhr.abort();
      reject(new Error("照片上傳逾時，請再試一次。"));
    }, 120000);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.max(1, Math.min(99, Math.round((event.loaded / event.total) * 100))));
    };
    xhr.onload = () => {
      window.clearTimeout(timeout);
      const data = JSON.parse(xhr.responseText || "{}") as { content?: TravelOSContent; error?: string; photo?: Photo };
      if (xhr.status < 200 || xhr.status >= 300 || !data.content || !data.photo) {
        reject(new Error(data.error ?? "照片上傳失敗。"));
        return;
      }
      onProgress(100);
      resolve({ content: data.content, photo: data.photo });
    };
    xhr.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("照片上傳失敗，請再試一次。"));
    };
    xhr.open("POST", "/api/trips/photos");
    xhr.send(formData);
  });
}

export default function TravelAdminPage() {
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>("story");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirtyTripIds, setDirtyTripIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("正在打開家庭遊記編輯…");
  const [storeSource, setStoreSource] = useState<"blob" | "drive" | "seed">("seed");
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [showAllPickerPhotos, setShowAllPickerPhotos] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [recordingEntryId, setRecordingEntryId] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const loadContent = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/trips/content", { cache: "no-store" });
    if (!response.ok) throw new Error("無法讀取旅行內容");
    const data = (await response.json()) as TravelContentResponse;
    const sorted = [...data.content.trips].sort((a, b) => b.startDate.localeCompare(a.startDate));
    setTrips(sorted);
    setActiveTripId((current) => current ?? sorted[0]?.id ?? null);
    setStoreSource(data.status.source);
    setMessage("草稿已經整理好。直接看、改一句，或錄一句話就可以。");
    setLoading(false);
  }, []);

  useEffect(() => {
    loadContent().catch(() => {
      setMessage("目前無法打開旅行內容。");
      setLoading(false);
    });
  }, [loadContent]);

  useEffect(() => () => mediaStreamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const sortedTrips = useMemo(() => [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate)), [trips]);
  const activeTrip = sortedTrips.find((trip) => trip.id === activeTripId) ?? sortedTrips[0] ?? null;
  const selectedPhoto = activeTrip?.photos.find((photo) => photo.id === selectedPhotoId) ?? activeTrip?.photos[0] ?? null;
  const promoVideos = activeTrip ? getTripPromoVideos(activeTrip.slug) : [];
  const pickerPhotos = useMemo(() => {
    if (!activeTrip || !pickerTarget) return [];
    const usedPhotoIds = new Set(activeTrip.journalEntries.map((entry) => entry.storyPhotoId).filter(Boolean));
    const entry = pickerTarget.kind === "journal" ? activeTrip.journalEntries.find((item) => item.id === pickerTarget.entryId) : null;
    const targetTime = Date.parse(entry?.entryDate ?? "");
    const ordered = [...activeTrip.photos].sort((a, b) => {
      if (entry?.storyPhotoId === a.id) return -1;
      if (entry?.storyPhotoId === b.id) return 1;
      if (pickerTarget.kind === "new") {
        const aUsed = usedPhotoIds.has(a.id) ? 1 : 0;
        const bUsed = usedPhotoIds.has(b.id) ? 1 : 0;
        if (aUsed !== bUsed) return aUsed - bUsed;
      }
      if (Number.isFinite(targetTime)) return Math.abs(photoTime(a) - targetTime) - Math.abs(photoTime(b) - targetTime);
      return photoTime(a) - photoTime(b);
    });
    return showAllPickerPhotos ? ordered : ordered.slice(0, 8);
  }, [activeTrip, pickerTarget, showAllPickerPhotos]);

  function openPicker(target: Exclude<PickerTarget, null>) {
    setShowAllPickerPhotos(false);
    setPickerTarget(target);
  }

  function updateActiveTrip(updater: (trip: TripDetail) => TripDetail) {
    if (!activeTrip) return;
    setTrips((current) => current.map((trip) => (trip.id === activeTrip.id ? { ...updater(trip), updatedAt: nowIso() } : trip)));
    setDirtyTripIds((current) => new Set(current).add(activeTrip.id));
    setMessage("有尚未儲存的變更。");
  }

  function updateJournalEntry(entryId: string, updates: Partial<JournalEntry>) {
    updateActiveTrip((trip) => ({
      ...trip,
      journalEntries: trip.journalEntries.map((entry) => entry.id === entryId ? { ...entry, ...updates, updatedAt: nowIso() } : entry),
    }));
  }

  function choosePhoto(photo: Photo | null) {
    if (!activeTrip || !pickerTarget) return;
    if (pickerTarget.kind === "new") {
      const now = nowIso();
      const index = photo ? activeTrip.photos.findIndex((item) => item.id === photo.id) : -1;
      const entry: JournalEntry = {
        id: makeId("journal"), tripId: activeTrip.id,
        title: photo ? photoLabel(photo, index) : "旅途中這一刻", body: "",
        entryDate: photo?.takenAt?.slice(0, 10) || activeTrip.startDate || now.slice(0, 10),
        storyPhotoId: photo?.id ?? null, mood: null, weatherSummary: null, aiSummary: null, voiceNoteUrl: null,
        createdAt: now, updatedAt: now,
      };
      updateActiveTrip((trip) => ({ ...trip, journalEntries: [...trip.journalEntries, entry] }));
      setMessage("已補上一段回憶，寫一句感想或錄一句話就可以。");
    } else {
      updateJournalEntry(pickerTarget.entryId, { storyPhotoId: photo?.id ?? null });
    }
    setPickerTarget(null);
  }

  function moveJournalEntry(index: number, direction: -1 | 1) {
    updateActiveTrip((trip) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= trip.journalEntries.length) return trip;
      const journalEntries = [...trip.journalEntries];
      const [entry] = journalEntries.splice(index, 1);
      journalEntries.splice(nextIndex, 0, entry);
      return { ...trip, journalEntries };
    });
  }

  function removeJournalEntry(entryId: string) {
    if (!window.confirm("要刪除這一段回憶嗎？")) return;
    updateActiveTrip((trip) => ({ ...trip, journalEntries: trip.journalEntries.filter((entry) => entry.id !== entryId) }));
  }

  async function persistTrips(drafts: TripDetail[]) {
    let latestContent: TravelOSContent | null = null;
    for (const trip of drafts) {
      const response = await fetch("/api/trips/content", {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ trip }),
      });
      const data = (await response.json()) as { content?: TravelOSContent; error?: string };
      if (!response.ok || !data.content) throw new Error(data.error ?? `「${trip.title}」儲存失敗`);
      latestContent = data.content;
    }
    return latestContent;
  }

  async function saveAllChanges() {
    const drafts = trips.filter((trip) => dirtyTripIds.has(trip.id));
    if (drafts.length === 0) return;
    setSaving(true);
    setMessage(`正在儲存 ${drafts.length} 個行程…`);
    try {
      const latestContent = await persistTrips(drafts);
      if (latestContent) setTrips(latestContent.trips);
      setDirtyTripIds(new Set());
      setStoreSource("drive");
      setMessage("全部變更已儲存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗，內容仍留在目前畫面。");
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeTrip) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setMessage("正在放入原始照片…");
    try {
      const drafts = trips.filter((trip) => dirtyTripIds.has(trip.id));
      if (drafts.length > 0) await persistTrips(drafts);
      formData.set("tripId", activeTrip.id);
      const data = await uploadTripPhotoWithProgress(formData, setUploadProgress);
      setTrips(data.content.trips);
      setSelectedPhotoId(data.photo.id);
      setDirtyTripIds(new Set());
      setStoreSource("drive");
      form.reset();
      setMessage("照片已保留原檔並放入這個行程。沒有壓縮或轉格式。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "照片上傳失敗。");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  async function startRecording(entryId: string) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) audioChunksRef.current.push(event.data); };
      recorder.onstop = () => void uploadRecording(entryId, new Blob(audioChunksRef.current, { type: recorder.mimeType }));
      recorder.start();
      setRecordingEntryId(entryId);
      setMessage("正在錄音。說完後按「完成錄音」。");
    } catch {
      setMessage("瀏覽器沒有取得麥克風，仍可直接寫一句感想。");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecordingEntryId(null);
    setMessage("正在放入這段錄音…");
  }

  async function uploadRecording(entryId: string, blob: Blob) {
    if (!activeTrip || blob.size === 0) return;
    const formData = new FormData();
    formData.set("tripId", activeTrip.id);
    formData.set("entryId", entryId);
    formData.set("file", new File([blob], `voice-${Date.now()}.webm`, { type: blob.type || "audio/webm" }));
    const response = await fetch("/api/trips/journal-audio", { method: "POST", body: formData });
    const data = (await response.json()) as { audioUrl?: string; error?: string };
    if (!response.ok || !data.audioUrl) {
      setMessage(data.error ?? "錄音沒有放入，請再試一次。");
      return;
    }
    updateJournalEntry(entryId, { voiceNoteUrl: data.audioUrl });
    setMessage("錄音已放入這段回憶，記得儲存全部變更。");
  }

  function updatePhotoCaption(photoId: string, caption: string) {
    updateActiveTrip((trip) => ({ ...trip, photos: trip.photos.map((photo) => photo.id === photoId ? { ...photo, caption: caption || null } : photo) }));
  }

  function movePhoto(photoId: string, direction: -1 | 1) {
    updateActiveTrip((trip) => {
      const index = trip.photos.findIndex((photo) => photo.id === photoId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= trip.photos.length) return trip;
      const photos = [...trip.photos];
      const [photo] = photos.splice(index, 1);
      photos.splice(nextIndex, 0, photo);
      return { ...trip, photos };
    });
  }

  function removePhoto(photoId: string) {
    if (!window.confirm("要從這個行程移除這張照片嗎？原始檔不會被修改。")) return;
    updateActiveTrip((trip) => ({
      ...trip, coverPhotoId: trip.coverPhotoId === photoId ? null : trip.coverPhotoId,
      photos: trip.photos.filter((photo) => photo.id !== photoId),
      journalEntries: trip.journalEntries.map((entry) => entry.storyPhotoId === photoId ? { ...entry, storyPhotoId: null, updatedAt: nowIso() } : entry),
    }));
    setSelectedPhotoId(null);
  }

  if (loading) {
    return <main className="travel-body grid min-h-screen place-items-center bg-[#f8f3ea] px-6 text-zinc-950"><p className="travel-display text-2xl font-semibold">正在打開遊記編輯…</p></main>;
  }

  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] pb-28 text-zinc-950">
      <fieldset className="m-0 min-w-0 border-0 p-0" disabled={saving || uploading}>
      <header className="border-b border-sky-100 bg-[linear-gradient(135deg,_#eaf6ff_0%,_#fff7ed_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className={secondaryButtonClass} href="/family">← 家庭入口</Link>
            {activeTrip && isTripPublic(activeTrip) ? <Link className={secondaryButtonClass} href={`/trips/${activeTrip.slug}`}>查看公開頁</Link> : <span className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-600">私人草稿</span>}
          </div>
          <p className="travel-hand mt-6 text-lg text-sky-800">family travel journal</p>
          <h1 className="travel-display mt-1 text-3xl font-semibold sm:text-5xl">遊記編輯</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">草稿、照片和文字已經整理好。家人只要看一遍，改想改的地方，或錄一句當時的感想。</p>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b border-sky-100 bg-[#f8f3ea]/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <label className="min-w-0 flex-1">
            <span className="sr-only">選擇行程</span>
            <select className="min-h-11 w-full rounded-2xl border border-sky-200 bg-white px-4 text-sm font-semibold text-zinc-900 lg:max-w-xl" onChange={(event) => setActiveTripId(event.target.value)} value={activeTrip?.id ?? ""}>
              {sortedTrips.map((trip) => <option key={trip.id} value={trip.id}>{trip.title}｜{toDateInput(trip.startDate)}</option>)}
            </select>
          </label>
          <div className="flex items-center justify-between gap-3">
            <p aria-live="polite" className="text-sm font-semibold text-zinc-600">{dirtyTripIds.size > 0 ? `${dirtyTripIds.size} 個行程尚未儲存` : "全部已儲存"}</p>
            <button className={primaryButtonClass} disabled={saving || dirtyTripIds.size === 0} onClick={() => void saveAllChanges()} type="button">{saving ? "儲存中…" : "儲存全部變更"}</button>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {activeTrip ? (
          <>
            <div className="overflow-x-auto pb-2"><nav aria-label="編輯內容" className="flex min-w-max gap-2">{tabs.map((item) => <button className={`travel-label min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === item.id ? "bg-sky-800 text-white" : "border border-sky-200 bg-white text-sky-900"}`} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}</nav></div>

            <div className="mt-5 rounded-3xl border border-sky-100 bg-white/95 p-4 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-sky-700">{activeTrip.city}・{activeTrip.country}</p><label className="mt-2 block"><span className="text-xs text-zinc-500">遊記標題 · 可直接修改</span><input aria-label="遊記標題" className={`${inputClass} font-semibold sm:text-2xl`} onChange={(event) => updateActiveTrip((trip) => ({ ...trip, title: event.target.value }))} value={activeTrip.title} /></label></div><span className="rounded-full bg-sky-50 px-3 py-2 text-xs font-semibold text-zinc-600">{activeTrip.photos.length} 張照片・{activeTrip.journalEntries.length} 段草稿</span></div>
              <label className="mt-4 block"><span className="text-sm font-semibold text-zinc-600">開場介紹 · 可直接修改</span><textarea aria-label="開場介紹" className={`${inputClass} min-h-28 leading-7`} onChange={(event) => updateActiveTrip((trip) => ({ ...trip, summary: event.target.value }))} value={activeTrip.summary} /></label>
            </div>

            {tab === "story" ? (
              <section className="mt-5 space-y-5">
                <div><h2 className="travel-display text-2xl font-semibold">一段一段看草稿</h2><p className="mt-1 text-sm text-zinc-600">照片和初稿已經配好。覺得對就保留；想補充時，寫一句或錄一句話。</p></div>
                {activeTrip.journalEntries.map((entry, index) => {
                  const photo = activeTrip.photos.find((item) => item.id === entry.storyPhotoId) ?? null;
                  return (
                    <article className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm" key={entry.id}>
                      <div className="grid lg:grid-cols-[18rem_1fr]">
                        <div className="relative min-h-48 overflow-hidden bg-stone-100">{photo ? <PhotoThumb className="h-full min-h-64" photo={photo} /> : <div className="grid min-h-64 place-items-center px-6 text-center text-sm font-semibold text-zinc-500">這一段還沒有照片</div>}<button className="absolute bottom-3 left-3 min-h-11 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white" onClick={() => openPicker({ kind: "journal", entryId: entry.id })} type="button">{photo ? "這張不對，換一張" : "補一張照片"}</button></div>
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-sky-700">草稿第 {index + 1} 段・{formatDate(photo?.takenAt ?? entry.entryDate)}</p><label className="mt-2 block"><span className="text-xs text-zinc-500">段落標題 · 可直接修改</span><input aria-label="段落標題" className={`${inputClass} font-semibold`} onChange={(event) => updateJournalEntry(entry.id, { title: event.target.value })} value={entry.title} /></label></div><div className="flex gap-2"><button aria-label="往前移" className={secondaryButtonClass} disabled={index === 0} onClick={() => moveJournalEntry(index, -1)} type="button">↑</button><button aria-label="往後移" className={secondaryButtonClass} disabled={index === activeTrip.journalEntries.length - 1} onClick={() => moveJournalEntry(index, 1)} type="button">↓</button></div></div>
                          <label className="mt-5 block"><span className="travel-label text-base font-semibold text-zinc-800">這一段想怎麼改？</span><textarea className={`${inputClass} min-h-40 leading-7`} onChange={(event) => updateJournalEntry(entry.id, { body: event.target.value })} placeholder="原稿可以直接改；只補一句也可以。" value={entry.body} /></label>
                          <div className="mt-4 flex flex-wrap items-center gap-3">{recordingEntryId === entry.id ? <button className="travel-label inline-flex min-h-11 items-center rounded-full bg-rose-700 px-5 py-3 text-sm font-semibold text-white" onClick={stopRecording} type="button">■ 完成錄音</button> : <button className={secondaryButtonClass} disabled={recordingEntryId !== null} onClick={() => void startRecording(entry.id)} type="button">● 補一句錄音</button>}{entry.voiceNoteUrl ? <audio className="h-11 max-w-full" controls src={entry.voiceNoteUrl} /> : <span className="text-xs text-zinc-500">不想打字，也可以直接說</span>}</div>
                          <details className="mt-5 border-t border-sky-100 pt-4"><summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-zinc-500">其他修改（平常不用）</summary><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><button className={secondaryButtonClass} onClick={() => removeJournalEntry(entry.id)} type="button">刪除這段</button></div></details>
                        </div>
                      </div>
                    </article>
                  );
                })}
                <div className="rounded-3xl border border-dashed border-sky-200 bg-white p-5 text-center"><p className="text-sm text-zinc-600">只有草稿真的少了一段，才需要補。</p><button className={`${secondaryButtonClass} mt-3`} onClick={() => openPicker({ kind: "new" })} type="button">＋ 補一段回憶</button></div>
              </section>
            ) : null}

            {tab === "photos" ? (
              <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
                <div><form className="rounded-3xl border border-dashed border-sky-200 bg-white p-5" onSubmit={uploadPhoto}><h2 className="travel-display text-2xl font-semibold">少了照片才從這裡補</h2><p className="mt-2 text-sm text-zinc-600">原檔直接放入，不壓縮、不轉格式。</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><input accept="image/*" className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-sky-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white`} name="file" required type="file" /><button className={primaryButtonClass} disabled={uploading} type="submit">{uploading ? `放入中 ${uploadProgress ?? 0}%` : "放入原始照片"}</button></div></form>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{activeTrip.photos.map((photo, index) => <button className={`overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 ${selectedPhoto?.id === photo.id ? "border-sky-600 ring-4 ring-sky-100" : "border-sky-100"}`} key={photo.id} onClick={() => setSelectedPhotoId(photo.id)} type="button"><PhotoThumb className="h-36 sm:h-40" photo={photo} /><span className="block p-3"><span className="block text-xs font-semibold text-sky-700">工作編號 #{index + 1}{photo.id === activeTrip.coverPhotoId ? "・封面" : ""}</span><span className="mt-1 block line-clamp-2 text-sm font-semibold text-zinc-800">{photoLabel(photo, index)}</span><span className="mt-1 block text-xs text-zinc-500">{formatDate(photo.takenAt)}</span></span></button>)}</div>
                </div>
                {selectedPhoto ? <aside className="h-fit rounded-3xl border border-sky-100 bg-white p-5 shadow-sm xl:sticky xl:top-28"><PhotoThumb className="h-56 rounded-2xl" photo={selectedPhoto} /><p className="mt-4 text-xs font-semibold text-sky-700">工作編號 #{activeTrip.photos.findIndex((photo) => photo.id === selectedPhoto.id) + 1}</p><p className="mt-1 text-sm text-zinc-500">{formatDate(selectedPhoto.takenAt)}</p><label className="mt-4 block"><span className="travel-label text-sm font-semibold">這張照片想留下什麼話？</span><textarea className={`${inputClass} min-h-28`} onChange={(event) => updatePhotoCaption(selectedPhoto.id, event.target.value)} value={selectedPhoto.caption ?? ""} /></label><div className="mt-4 grid grid-cols-2 gap-2"><button className={secondaryButtonClass} onClick={() => updateActiveTrip((trip) => ({ ...trip, coverPhotoId: selectedPhoto.id }))} type="button">設為封面</button><button className={secondaryButtonClass} onClick={() => removePhoto(selectedPhoto.id)} type="button">移除照片</button><button className={secondaryButtonClass} disabled={activeTrip.photos[0]?.id === selectedPhoto.id} onClick={() => movePhoto(selectedPhoto.id, -1)} type="button">往前</button><button className={secondaryButtonClass} disabled={activeTrip.photos.at(-1)?.id === selectedPhoto.id} onClick={() => movePhoto(selectedPhoto.id, 1)} type="button">往後</button></div></aside> : null}
              </section>
            ) : null}

            {tab === "videos" ? <section className="mt-5">{promoVideos.length > 0 ? <ShortVideoGallery videos={promoVideos} /> : <div className="rounded-3xl border border-dashed border-sky-200 bg-white p-8 text-center text-zinc-600">這個行程目前沒有短片草稿。</div>}</section> : null}

            {tab === "details" ? <section className="mt-5 rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-7"><h2 className="travel-display text-2xl font-semibold">系統整理好的行程資料</h2><p className="mt-2 text-sm leading-6 text-zinc-600">這些只是背景資訊。看草稿、寫感想時不需要填。</p><dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">時間</dt><dd className="mt-1 font-semibold">{formatDate(activeTrip.startDate)}－{formatDate(activeTrip.endDate)}</dd></div><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">地方</dt><dd className="mt-1 font-semibold">{activeTrip.city}・{activeTrip.country}</dd></div><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">狀態</dt><dd className="mt-1 font-semibold">{isTripPublic(activeTrip) ? "公開" : "私人草稿"}</dd></div><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">系統整理</dt><dd className="mt-1 font-semibold">{activeTrip.places.length} 個地點・{(activeTrip.travelRoute ?? []).length} 段路線</dd></div></dl><details className="mt-6 rounded-2xl border border-sky-100 p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-sky-900">真的需要時才修改基本資料</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="行程名稱" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, title: value }))} value={activeTrip.title} /><Field label="公開網址名稱" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, slug: value }))} value={activeTrip.slug} /><Field label="城市" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, city: value }))} value={activeTrip.city} /><Field label="國家" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, country: value }))} value={activeTrip.country} /><Field label="開始日期" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, startDate: value }))} type="date" value={toDateInput(activeTrip.startDate)} /><Field label="結束日期" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, endDate: value }))} type="date" value={toDateInput(activeTrip.endDate)} /><label className="block sm:col-span-2"><span className="travel-label text-sm font-semibold text-zinc-700">行程簡介</span><textarea className={`${inputClass} min-h-28`} onChange={(event) => updateActiveTrip((trip) => ({ ...trip, summary: event.target.value }))} value={activeTrip.summary} /></label><label className="block sm:col-span-2"><span className="travel-label text-sm font-semibold text-zinc-700">公開狀態</span><select className={inputClass} onChange={(event) => updateActiveTrip((trip) => ({ ...trip, visibility: event.target.value as TravelVisibility }))} value={activeTrip.visibility}><option value="private">私人草稿</option><option value="public">公開</option></select></label></div></details></section> : null}
          </>
        ) : <div className="rounded-3xl border border-sky-100 bg-white p-8 text-center"><h2 className="travel-display text-2xl font-semibold">目前沒有行程</h2></div>}

        <p aria-live="polite" className="mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-600 shadow-sm">{message}<span className="ml-2 text-xs font-normal text-zinc-400">{storeSource === "blob" ? "雲端工作台" : storeSource === "drive" ? "家庭共用儲存" : "初始內容"}</span></p>
      </section>

      {pickerTarget && activeTrip ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-6" role="dialog"><section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-3xl bg-[#f8f3ea] shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-white px-5 py-4"><div><h2 className="travel-display text-2xl font-semibold">{pickerTarget.kind === "new" ? "系統先挑出尚未使用的照片" : "先看這一段附近的照片"}</h2><p className="mt-1 text-sm text-zinc-600">不用從頭翻相簿。先看少量建議；真的找不到，再查看全部照片。</p></div><button className={secondaryButtonClass} onClick={() => setPickerTarget(null)} type="button">關閉</button></div><div className="max-h-[72vh] overflow-y-auto p-4 sm:p-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{pickerPhotos.map((photo) => { const index = activeTrip.photos.findIndex((item) => item.id === photo.id); return <button className="overflow-hidden rounded-2xl border border-sky-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-500" key={photo.id} onClick={() => choosePhoto(photo)} type="button"><PhotoThumb className="h-40 sm:h-44" photo={photo} /><span className="block p-3"><span className="block text-xs font-semibold text-sky-700">工作編號 #{index + 1}</span><span className="mt-1 block line-clamp-2 text-sm font-semibold">{photoLabel(photo, index)}</span><span className="mt-1 block text-xs text-zinc-500">{formatDate(photo.takenAt)}</span><span className="mt-3 block rounded-full bg-sky-800 px-3 py-2 text-center text-xs font-semibold text-white">選擇這張照片</span></span></button>; })}</div>{!showAllPickerPhotos && activeTrip.photos.length > pickerPhotos.length ? <button className={`${secondaryButtonClass} mt-5 w-full`} onClick={() => setShowAllPickerPhotos(true)} type="button">建議裡沒有，再查看全部 {activeTrip.photos.length} 張</button> : null}{pickerTarget.kind === "new" ? <button className={`${secondaryButtonClass} mt-3 w-full`} onClick={() => choosePhoto(null)} type="button">這一段沒有照片，直接寫一句</button> : null}</div></section></div> : null}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-100 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"><button className={`${primaryButtonClass} w-full`} disabled={saving || dirtyTripIds.size === 0} onClick={() => void saveAllChanges()} type="button">{saving ? "儲存中…" : dirtyTripIds.size > 0 ? `儲存全部變更（${dirtyTripIds.size}）` : "全部已儲存"}</button></div>
      </fieldset>
    </main>
  );
}
