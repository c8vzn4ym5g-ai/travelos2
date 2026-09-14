"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { JOURNAL_ENTRY_KINDS, journalEntryKind } from "@/lib/journal-entry-kind";
import { EditorLivePreview } from "@/components/editor-live-preview";
import { VisualJournalEditor } from "@/components/visual-journal-editor";
import { JournalReader } from "@/components/journal-reader";
import { EditorCover } from "@/components/editor-cover";
import { setTripCover } from "@/lib/trip-cover";
import { publishedTrip } from "@/lib/trip-publication";
import { ShortVideoGallery } from "@/components/short-video-gallery";
import { reconcileSavedTrips, reconcileUploadedPhoto } from "@/lib/editor-save";
import { rememberEditorLibrary, rememberSavedEditorTrips } from "@/lib/editor-session-cache";
import { loadEditorLibrary, loadSelectedEditorTrip, type EditorCatalogItem } from "@/lib/editor-library-load";
import { exportTripToObsidian } from "@/lib/obsidian-export";
import type { TravelOSContent } from "@/lib/editable-store";
import {
  applyTripLocalDrafts,
  clearTripLocalDraft,
  EDITOR_LOCAL_DRAFT_DEBOUNCE_MS,
  EDITOR_LOCAL_DRAFT_INTERVAL_MS,
  writeTripLocalDraft,
} from "@/lib/editor-local-draft";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders, resolveFamilySession } from "@/lib/family-session";
import { canonicalSiteUrl, isSpareVercelHost } from "@/lib/site-url";
import { getTripPromoVideos } from "@/lib/promo-videos";
import { formatEditorTripPickerLabel } from "@/lib/editor-trip-label";
import { formatCalendarDate, formatJournalDate, formatPhotoDate } from "@/lib/editor-calendar-date";
import { isTripPhotoVideo } from "@/lib/trip-photo";
import { compareTripsByStartDateDesc, isTripPublic } from "@/lib/trip-visibility";
import type { JournalEntry, Photo, TripDetail } from "@/lib/types";

type EditorTab = "story" | "photos" | "videos" | "details";
type PickerTarget = { kind: "cover" } | { kind: "new" } | { kind: "journal"; entryId: string } | null;

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
  return formatCalendarDate(value);
}

function photoLabel(photo: Photo, index: number) {
  if (photo.caption?.trim()) return photo.caption.trim();
  if (photo.originalFilename) return photo.originalFilename;
  return isTripPhotoVideo(photo) ? `Video ${index + 1}` : `照片 ${index + 1}`;
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
    return <div className={`${className} grid w-full place-items-center bg-stone-100 text-sm text-zinc-500`}>{isTripPhotoVideo(photo) ? "影片整理中" : "照片整理中"}</div>;
  }
  if (isTripPhotoVideo(photo)) {
    return (
      <video
        aria-label={photo.caption ?? photo.originalFilename}
        className={`${className} w-full object-cover`}
        controls
        onClick={(event) => event.stopPropagation()}
        playsInline
        preload="metadata"
        src={photo.storageKey}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={photo.caption ?? photo.originalFilename} className={`${className} w-full object-cover`} src={photo.storageKey} />
  );
}

function PhotoCardMeta({ cover, index, photo }: { cover?: boolean; index: number; photo: Photo }) {
  return (
    <span className="block p-3">
      <span className="block text-xs font-semibold text-sky-700">
        工作編號 #{index + 1}
        {cover ? "・封面" : ""}
        {isTripPhotoVideo(photo) ? "・Video" : ""}
      </span>
      <span className="mt-1 block line-clamp-2 text-sm font-semibold text-zinc-800">{photoLabel(photo, index)}</span>
      <span className="mt-1 block text-xs text-zinc-500">{formatPhotoDate(photo)}</span>
    </span>
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

function pinHeaders(pin: string) {
  return familyPinHeaders(pin);
}

function sessionPin(fallback: string) {
  return window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? fallback;
}

function requestedTripId() {
  return new URLSearchParams(window.location.search).get("trip")?.trim() || null;
}

function uploadTripPhotoWithProgress(formData: FormData, pin: string, onProgress: (progress: number) => void) {
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
    const headers = pinHeaders(pin);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.send(formData);
  });
}

export default function TravelAdminPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [catalog, setCatalog] = useState<EditorCatalogItem[]>([]);
  const [tripLoadError, setTripLoadError] = useState(false);
  const [tripReadAttempt, setTripReadAttempt] = useState(0);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [tab, setTab] = useState<EditorTab>("story");
  const [advancedEditor, setAdvancedEditor] = useState(false);
  const [draftPreview, setDraftPreview] = useState(false);
  const [publishedPreview, setPublishedPreview] = useState(false);
  const editorScrollRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [catalogWarning, setCatalogWarning] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirtyTripIds, setDirtyTripIds] = useState<Set<string>>(new Set());
  const [recoveredTripIds, setRecoveredTripIds] = useState<string[]>([]);
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
  const tripsRef = useRef<TripDetail[]>([]);
  const dirtyTripIdsRef = useRef<Set<string>>(new Set());
  const baseVersionsRef = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;

    void resolveFamilySession().then((session) => {
      if (cancelled) {
        return;
      }

      if (session.allowed) {
        setPin(session.pin);
        setAuthenticated(true);
        return;
      }

      setRedirecting(true);
      router.replace("/family");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  const loadContent = useCallback(async (options?: { silent?: boolean }) => {
    setLoadFailed(false);
    if (isSpareVercelHost(window.location.host)) {
      window.location.replace(canonicalSiteUrl(`${window.location.pathname}${window.location.search}`));
      return;
    }
    if (!options?.silent) setLoading(true);
    const data = await loadEditorLibrary(pinHeaders(sessionPin(pin)));
    setCatalog(data.trips);
    const requested = requestedTripId();
    if (requested && data.trips.some(trip => trip.id === requested)) setActiveTripId(requested);
    setStoreSource("drive");
    setMessage("選一篇遊記後才讀取內容。");
    setLoading(false);
  }, [pin]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    loadContent().catch(() => {
      setLoadFailed(true);
      setMessage("目前無法打開旅行內容。");
      setLoading(false);
    });
  }, [authenticated, loadContent]);

  useEffect(() => {
    if (!authenticated || !activeTripId) return;
    if (tripsRef.current.some(trip => trip.id === activeTripId)) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    setTripLoadError(false);
    void loadSelectedEditorTrip(activeTripId, pinHeaders(sessionPin(pin)), controller.signal).then(trip => {
      if (cancelled) return;
      const data = {trip};
      baseVersionsRef.current.set(data.trip.id, data.trip.updatedAt);
      const applied = applyTripLocalDrafts([data.trip]);
      setTrips(current => [...current.filter(trip => trip.id !== data.trip.id), ...applied.trips]);
      if (applied.restoredIds.length) {
        setDirtyTripIds(current => new Set([...current, ...applied.restoredIds]));
        setRecoveredTripIds(current => [...new Set([...current, ...applied.restoredIds])]);
      }
      setMessage(applied.restoredIds.length ? "有未保存草稿，已幫你找回。" : "已開啟這篇遊記。");
    }).catch(() => { if (!cancelled) setTripLoadError(true); })
      .finally(() => { clearTimeout(timer); });
    return () => { cancelled = true; clearTimeout(timer); controller.abort(); };
  }, [activeTripId, authenticated, pin, tripReadAttempt]);
  useEffect(() => {
    tripsRef.current = trips;
    dirtyTripIdsRef.current = dirtyTripIds;
  }, [dirtyTripIds, trips]);

  const flushLocalDrafts = useCallback(() => {
    for (const trip of tripsRef.current) {
      if (dirtyTripIdsRef.current.has(trip.id)) {
        writeTripLocalDraft(trip);
      }
    }
  }, []);

  useEffect(() => {
    if (dirtyTripIds.size === 0) {
      return;
    }

    const handle = window.setTimeout(flushLocalDrafts, EDITOR_LOCAL_DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [dirtyTripIds, flushLocalDrafts, trips]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        flushLocalDrafts();
      }
    };
    const onPageHide = () => flushLocalDrafts();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("blur", flushLocalDrafts);
    const interval = window.setInterval(flushLocalDrafts, EDITOR_LOCAL_DRAFT_INTERVAL_MS);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("blur", flushLocalDrafts);
      window.clearInterval(interval);
    };
  }, [flushLocalDrafts]);

  useEffect(() => {
    if (dirtyTripIds.size === 0) {
      return;
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      flushLocalDrafts();
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirtyTripIds.size, flushLocalDrafts]);

  useEffect(() => () => mediaStreamRef.current?.getTracks().forEach((track) => track.stop()), []);

  const sortedTrips = useMemo(() => catalog.map(item => {
    const draft = trips.find(trip => trip.id === item.id);
    return draft ? { ...item, title: draft.title, startDate: draft.startDate, endDate: draft.endDate } : item;
  }).sort(compareTripsByStartDateDesc), [catalog, trips]);
  const activeTrip = trips.find((trip) => trip.id === activeTripId) ?? null;
  const selectedPhoto = activeTrip?.photos.find((photo) => photo.id === selectedPhotoId) ?? activeTrip?.photos[0] ?? null;
  const promoVideos = activeTrip ? getTripPromoVideos(activeTrip.slug) : [];
  const pickerPhotos = useMemo(() => {
    if (!activeTrip || !pickerTarget) return [];
    const usedPhotoIds = new Set(activeTrip.journalEntries.map((entry) => entry.storyPhotoId).filter(Boolean));
    const entry = pickerTarget.kind === "journal" ? activeTrip.journalEntries.find((item) => item.id === pickerTarget.entryId) : null;
    const targetTime = Date.parse(entry?.entryDate ?? "");
    const ordered = activeTrip.photos.filter(photo => pickerTarget.kind !== "cover" || !isTripPhotoVideo(photo)).sort((a, b) => {
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
        entryDate: photo?.captureMetadata?.localTakenAt?.slice(0, 10) || photo?.takenAt?.slice(0, 10) || activeTrip.startDate || now.slice(0, 10),
        storyPhotoId: photo?.id ?? null, mood: null, weatherSummary: null, aiSummary: null, voiceNoteUrl: null,
        createdAt: now, updatedAt: now,
      };
      updateActiveTrip((trip) => ({ ...trip, journalEntries: [...trip.journalEntries, entry] }));
      setMessage("已補上一段回憶，寫一句感想或錄一句話就可以。");
    } else if (pickerTarget.kind === "cover" && photo) {
      updateActiveTrip(trip => setTripCover(trip, photo));
    } else if (pickerTarget.kind === "journal") {
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

  async function persistTrips(drafts: TripDetail[], publish = false) {
    setCatalogWarning("");
    const savedTrips: TripDetail[] = [];
    for (const trip of drafts) {
      const response = await fetch("/api/trips/content", {
        method: "PUT",
        headers: { "content-type": "application/json", ...pinHeaders(sessionPin(pin)) },
        body: JSON.stringify({ trip, baseUpdatedAt: baseVersionsRef.current.get(trip.id), publish }),
      });
      const data = (await response.json()) as { trip?: TripDetail; error?: string; warning?: string };
      if (!response.ok || !data.trip) throw new Error(data.error ?? `「${trip.title}」儲存失敗`);
      savedTrips.push(data.trip);
      if (data.warning) setCatalogWarning(data.warning);
      setCatalog(current => current.map(item => item.id === data.trip!.id ? {id:data.trip!.id, title:data.trip!.title, startDate:data.trip!.startDate, endDate:data.trip!.endDate, updatedAt:data.trip!.updatedAt} : item));
      baseVersionsRef.current.set(data.trip.id, data.trip.updatedAt);
      rememberSavedEditorTrips(sessionPin(pin), [data.trip]);
    }
    return savedTrips;
  }

  async function saveAllChanges() {
    const drafts = trips.filter((trip) => dirtyTripIds.has(trip.id));
    if (drafts.length === 0) return;
    setSaving(true);
    setMessage(`正在儲存 ${drafts.length} 個行程…`);
    try {
      const saved = await persistTrips(drafts);
      const reconciled = reconcileSavedTrips(tripsRef.current, drafts, saved);
      tripsRef.current = reconciled.trips;
      setTrips(reconciled.trips);
      for (const id of reconciled.acknowledged) {
        clearTripLocalDraft(id);
      }
      setDirtyTripIds(current => new Set([...current].filter(id => !reconciled.acknowledged.includes(id))));
      setRecoveredTripIds(current => current.filter(id => !reconciled.acknowledged.includes(id)));
      setStoreSource("drive");
      setMessage(reconciled.acknowledged.length === drafts.length ? "本次變更已儲存。" : "本次已儲存；剛補寫的內容仍待儲存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗，內容仍留在目前畫面。");
    } finally {
      setSaving(false);
    }
  }

  async function publishActiveTrip() {
    if (!activeTrip || saving) return;
    if (!window.confirm(`確認把「${activeTrip.title}」目前內容更新為公開版？行前計畫不會放入公開正文；請先核對住宿、地圖與實際經歷。`)) return;
    const drafts = [activeTrip];
    setSaving(true);
    setMessage("正在更新公開版…");
    try {
      const saved = await persistTrips(drafts, true);
      const reconciled = reconcileSavedTrips(tripsRef.current, drafts, saved);
      tripsRef.current = reconciled.trips;
      setTrips(reconciled.trips);
      for (const id of reconciled.acknowledged) clearTripLocalDraft(id);
      setDirtyTripIds(current => new Set([...current].filter(id => !reconciled.acknowledged.includes(id))));
      setRecoveredTripIds(current => current.filter(id => !reconciled.acknowledged.includes(id)));
      setMessage("公開版已更新。之後的編輯會先保留為草稿。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "公開版更新失敗，草稿仍保留。");
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
      const submitted = tripsRef.current;
      const drafts = trips.filter((trip) => dirtyTripIds.has(trip.id));
      if (drafts.length > 0) await persistTrips(drafts);
      formData.set("tripId", activeTrip.id);
      const data = await uploadTripPhotoWithProgress(formData, sessionPin(pin), setUploadProgress);
      const reconciled = reconcileUploadedPhoto(tripsRef.current, submitted, data.content.trips, activeTrip.id, data.photo.id);
      tripsRef.current = reconciled.trips;
      setTrips(reconciled.trips);
      rememberEditorLibrary(sessionPin(pin), data.content.trips, "drive");
      const remoteTrip = data.content.trips.find(trip => trip.id === activeTrip.id);
      if (remoteTrip) baseVersionsRef.current.set(remoteTrip.id, remoteTrip.updatedAt);
      setSelectedPhotoId(data.photo.id);
      for (const trip of drafts) {
        if (reconciled.acknowledged.includes(trip.id)) clearTripLocalDraft(trip.id);
      }
      setDirtyTripIds(current => new Set([...current].filter(id => !reconciled.acknowledged.includes(id))));
      setRecoveredTripIds(current => current.filter(id => !reconciled.acknowledged.includes(id)));
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
    const response = await fetch("/api/trips/journal-audio", {
      method: "POST",
      headers: pinHeaders(sessionPin(pin)),
      body: formData,
    });
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

  function discardRecoveredDrafts() {
    for (const tripId of recoveredTripIds) {
      clearTripLocalDraft(tripId);
    }
    const discarded = new Set(recoveredTripIds);
    tripsRef.current = tripsRef.current.filter(trip => !discarded.has(trip.id));
    setTrips(tripsRef.current);
    setDirtyTripIds(current => new Set([...current].filter(id => !discarded.has(id))));
    setRecoveredTripIds([]);
    setTripReadAttempt(value => value + 1);
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

  if (!authenticated) {
    return (
      <main className="travel-body grid min-h-screen place-items-center bg-[#f8f3ea] px-6 text-zinc-950">
        <p className="travel-display text-2xl font-semibold">
          {redirecting ? "正在返回家庭入口…" : "正在開啟遊記編輯…"}
        </p>
      </main>
    );
  }

  if (loading) {
    return <main className="travel-body grid min-h-screen place-items-center bg-[#f8f3ea] px-6 text-zinc-950"><div className="text-center"><p className="travel-display text-2xl font-semibold">正在讀取行程…</p><Link className={`${secondaryButtonClass} mt-6`} href="/family">← 家庭入口</Link></div></main>;
  }

  if (loadFailed && trips.length === 0) {
    return <main className="travel-body grid min-h-screen place-items-center bg-[#f8f3ea] px-6 text-zinc-950"><div className="max-w-md text-center"><h1 className="travel-display text-2xl font-semibold">行程暫時未能載入</h1><p role="alert" className="mt-3 leading-7">這次讀取未完成，並不代表沒有行程。請重新讀取。</p><button className={`${primaryButtonClass} mt-6`} type="button" onClick={() => void loadContent().catch(() => { setLoadFailed(true); setLoading(false); })}>重新讀取行程</button><Link className={`${secondaryButtonClass} mt-4`} href="/family">← 家庭入口</Link></div></main>;
  }

  if (activeTrip && !advancedEditor) return <VisualJournalEditor key={activeTrip.id} trip={activeTrip} onChange={next=>updateActiveTrip(()=>next)} onSave={()=>void saveAllChanges()} onPublish={()=>void publishActiveTrip()} onLibrary={()=>{flushLocalDrafts();setActiveTripId(null);}} onAdvanced={nextTab=>{editorScrollRef.current=window.scrollY;setTab(nextTab);setAdvancedEditor(true);window.scrollTo(0,0);}} dirty={dirtyTripIds.has(activeTrip.id)} busy={saving||uploading} message={message} />;

  if ((draftPreview || publishedPreview) && activeTrip) {
    return <JournalReader trip={publishedPreview ? publishedTrip(activeTrip) ?? activeTrip : activeTrip} previewLabel={publishedPreview ? "目前公開版" : "工作稿 · 尚未公開"} onBack={() => {
      setDraftPreview(false);
      setPublishedPreview(false);
      window.requestAnimationFrame(() => window.scrollTo(0, editorScrollRef.current));
    }} />;
  }

  return (
    <main className="editor-workspace travel-body min-h-screen bg-[#f8f3ea] pb-28 text-zinc-950">
      <fieldset className="m-0 min-w-0 border-0 p-0" disabled={saving || uploading}>
      <header className="border-b border-sky-100 bg-[linear-gradient(135deg,_#eaf6ff_0%,_#fff7ed_100%)]">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className={secondaryButtonClass} href="/family">← 家庭入口</Link>
            {advancedEditor && activeTrip ? <button className={primaryButtonClass} type="button" onClick={()=>{setAdvancedEditor(false);requestAnimationFrame(()=>window.scrollTo(0,editorScrollRef.current));}}>← 回到版面編輯</button> : null}
            {activeTripId ? <button className={secondaryButtonClass} type="button" onClick={() => { flushLocalDrafts(); setActiveTripId(null); }}>← 遊記目錄</button> : null}
            {activeTrip ? <><button className={secondaryButtonClass} onClick={() => { editorScrollRef.current = window.scrollY; setDraftPreview(true); window.scrollTo(0, 0); }} type="button">預覽工作稿</button>
            {isTripPublic(activeTrip) ? <button type="button" className={secondaryButtonClass} onClick={() => { flushLocalDrafts(); editorScrollRef.current = window.scrollY; setPublishedPreview(true); window.scrollTo(0, 0); }}>查看目前公開版</button> : <span className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-zinc-600">私人草稿</span>}</> : null}
          </div>
          <p className="travel-hand mt-6 text-lg text-sky-800">family travel journal</p>
          <h1 className="travel-display mt-1 text-3xl font-semibold sm:text-5xl">遊記編輯</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600">先選一段旅程，再把記憶寫進去。手機隨手補充，電腦慢慢整理。</p>
        </div>
      </header>

      {activeTripId ? <div className="sticky top-0 z-30 border-b border-sky-100 bg-[#f8f3ea]/95 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <label className="min-w-0 flex-1">
            <span className="sr-only">選擇行程</span>
            <select className="min-h-11 w-full rounded-2xl border border-sky-200 bg-white px-4 text-sm font-semibold text-zinc-900 lg:max-w-xl" onChange={(event) => { flushLocalDrafts(); setTripLoadError(false); setActiveTripId(event.target.value || null); }} value={activeTripId ?? ""}>
              <option value="">選擇一篇遊記</option>
              {sortedTrips.map((trip) => <option key={trip.id} value={trip.id}>{formatEditorTripPickerLabel(trip.title, trip.startDate)}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button className={secondaryButtonClass} disabled={!activeTrip} onClick={() => {
              if (!activeTrip) return;
              const exported = exportTripToObsidian(activeTrip);
              const url = URL.createObjectURL(new Blob([exported.markdown], { type: "text/markdown;charset=utf-8" }));
              const link = document.createElement("a");
              link.href = url;
              link.download = exported.filename;
              link.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000);
              setMessage("已匯出目前文稿，可放入 Obsidian；這是私人副本，尚未儲存的修改也會包含其中。");
            }} type="button">匯出文稿</button>
            <p aria-live="polite" className="text-sm font-semibold text-zinc-600">{dirtyTripIds.size > 0 ? `${dirtyTripIds.size} 個行程尚未儲存` : "全部已儲存"}</p>
            <button className={primaryButtonClass} disabled={saving || dirtyTripIds.size === 0} onClick={() => void saveAllChanges()} type="button">{saving ? "儲存中…" : "儲存全部變更"}</button>
            <button className={secondaryButtonClass} disabled={saving || !activeTrip} onClick={() => void publishActiveTrip()} type="button">{activeTrip && isTripPublic(activeTrip) ? "更新公開版" : "公開這篇遊記"}</button>
          </div>
          {recoveredTripIds.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-white px-4 py-3" data-editor-recovered-draft="">
              <p className="text-sm font-semibold text-sky-900">有未保存草稿 · 已幫你找回</p>
              <button className={secondaryButtonClass} onClick={discardRecoveredDrafts} type="button">放棄草稿</button>
            </div>
          ) : null}
        </div>
      </div> : null}

      <section className={activeTrip ? "editor-work-area mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8" : "mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8"}>
        {!activeTripId && dirtyTripIds.size > 0 ? <div className="mb-4 flex flex-wrap items-center gap-3"><p>{dirtyTripIds.size} 篇遊記尚未儲存，修改仍保留。</p><button className={primaryButtonClass} type="button" onClick={() => void saveAllChanges()}>儲存全部變更</button></div> : null}
        {catalogWarning ? <p role="status" className="mb-4 rounded-2xl bg-amber-50 p-4 text-amber-900">{catalogWarning}</p> : null}
        {activeTrip ? (
          <div className="editor-fields">
            <EditorCover trip={activeTrip} onChange={next => updateActiveTrip(() => next)} onChoose={() => openPicker({kind: "cover"})} />
            <div className="editor-tabs overflow-x-auto pb-2"><nav aria-label="編輯內容" className="flex min-w-max gap-2">{tabs.map((item) => <button className={`travel-label min-h-11 rounded-full px-5 py-2.5 text-sm font-semibold transition ${tab === item.id ? "bg-sky-800 text-white" : "border border-sky-200 bg-white text-sky-900"}`} key={item.id} onClick={() => setTab(item.id)} type="button">{item.label}</button>)}</nav></div>

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
                      <div className="editor-story-row grid lg:grid-cols-[18rem_1fr]">
                        <div className="relative min-h-48 overflow-hidden bg-stone-100">{photo ? <PhotoThumb className="h-full min-h-64" photo={photo} /> : <div className="grid min-h-64 place-items-center px-6 text-center text-sm font-semibold text-zinc-500">這一段還沒有照片</div>}<button className="absolute bottom-3 left-3 min-h-11 rounded-full bg-black/70 px-4 py-2 text-xs font-semibold text-white" onClick={() => openPicker({ kind: "journal", entryId: entry.id })} type="button">{photo ? "這張不對，換一張" : "補一張照片"}</button></div>
                        <div className="p-5 sm:p-6">
                          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold text-sky-700">草稿第 {index + 1} 段・{formatJournalDate(entry.entryDate, photo)}</p><label className="mt-2 block"><span className="text-xs text-zinc-500">段落標題 · 可直接修改</span><input aria-label="段落標題" className={`${inputClass} font-semibold`} onChange={(event) => updateJournalEntry(entry.id, { title: event.target.value })} value={entry.title} /></label></div><div className="flex gap-2"><button aria-label="往前移" className={secondaryButtonClass} disabled={index === 0} onClick={() => moveJournalEntry(index, -1)} type="button">↑</button><button aria-label="往後移" className={secondaryButtonClass} disabled={index === activeTrip.journalEntries.length - 1} onClick={() => moveJournalEntry(index, 1)} type="button">↓</button></div></div>
                          <label className="mt-4 block"><span className="travel-label text-sm font-semibold text-zinc-700">這一段是什麼？</span><select aria-label={`段落分類：${entry.title}`} className={inputClass} value={journalEntryKind(entry)} onChange={event => updateJournalEntry(entry.id, { entryKind: event.target.value as JournalEntry["entryKind"] })}>{JOURNAL_ENTRY_KINDS.map(([kind, label]) => <option key={kind} value={kind}>{label}</option>)}</select></label>
                          <p className="mt-2 text-xs leading-6 text-zinc-500">行前計畫保留在家庭紀錄。分類不代表地圖與住宿已核對，變更的安排也要一起確認。</p>
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
                <div><form className="rounded-3xl border border-dashed border-sky-200 bg-white p-5" onSubmit={uploadPhoto}><h2 className="travel-display text-2xl font-semibold">少了照片才從這裡補</h2><p className="mt-2 text-sm text-zinc-600">選擇照片，補進這段旅程。</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><input accept="image/*" className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-sky-800 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white`} name="file" required type="file" /><button className={primaryButtonClass} disabled={uploading} type="submit">{uploading ? `放入中 ${uploadProgress ?? 0}%` : "放入原始照片"}</button></div></form>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {activeTrip.photos.map((photo, index) => {
                      const selected = selectedPhoto?.id === photo.id;
                      const cardClass = `overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 ${selected ? "border-sky-600 ring-4 ring-sky-100" : "border-sky-100"}`;
                      const meta = <PhotoCardMeta cover={photo.id === activeTrip.coverPhotoId} index={index} photo={photo} />;
                      if (isTripPhotoVideo(photo)) {
                        return (
                          <article className={cardClass} key={photo.id}>
                            <PhotoThumb className="h-36 sm:h-40" photo={photo} />
                            <button className="block w-full text-left" onClick={() => setSelectedPhotoId(photo.id)} type="button">
                              {meta}
                            </button>
                          </article>
                        );
                      }
                      return (
                        <button className={cardClass} key={photo.id} onClick={() => setSelectedPhotoId(photo.id)} type="button">
                          <PhotoThumb className="h-36 sm:h-40" photo={photo} />
                          {meta}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {selectedPhoto ? (
                  <aside className="h-fit rounded-3xl border border-sky-100 bg-white p-5 shadow-sm xl:sticky xl:top-28">
                    <PhotoThumb className="h-56 rounded-2xl" photo={selectedPhoto} />
                    <p className="mt-4 text-xs font-semibold text-sky-700">
                      工作編號 #{activeTrip.photos.findIndex((photo) => photo.id === selectedPhoto.id) + 1}
                      {isTripPhotoVideo(selectedPhoto) ? "・Video" : ""}
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">{formatPhotoDate(selectedPhoto)}</p>
                    <label className="mt-4 block">
                      <span className="travel-label text-sm font-semibold">{isTripPhotoVideo(selectedPhoto) ? "這段影片想留下什麼話？" : "這張照片想留下什麼話？"}</span>
                      <textarea className={`${inputClass} min-h-28`} onChange={(event) => updatePhotoCaption(selectedPhoto.id, event.target.value)} value={selectedPhoto.caption ?? ""} />
                    </label>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button className={secondaryButtonClass} onClick={() => updateActiveTrip((trip) => ({ ...trip, coverPhotoId: selectedPhoto.id }))} type="button">設為封面</button>
                      <button className={secondaryButtonClass} onClick={() => removePhoto(selectedPhoto.id)} type="button">{isTripPhotoVideo(selectedPhoto) ? "移除影片" : "移除照片"}</button>
                      <button className={secondaryButtonClass} disabled={activeTrip.photos[0]?.id === selectedPhoto.id} onClick={() => movePhoto(selectedPhoto.id, -1)} type="button">往前</button>
                      <button className={secondaryButtonClass} disabled={activeTrip.photos.at(-1)?.id === selectedPhoto.id} onClick={() => movePhoto(selectedPhoto.id, 1)} type="button">往後</button>
                    </div>
                  </aside>
                ) : null}
              </section>
            ) : null}

            {tab === "videos" ? <section className="mt-5">{promoVideos.length > 0 ? <ShortVideoGallery videos={promoVideos} /> : <div className="rounded-3xl border border-dashed border-sky-200 bg-white p-8 text-center text-zinc-600">這個行程目前沒有短片草稿。</div>}</section> : null}

            {tab === "details" ? <section className="mt-5 rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-7"><h2 className="travel-display text-2xl font-semibold">系統整理好的行程資料</h2><p className="mt-2 text-sm leading-6 text-zinc-600">這些只是背景資訊。看草稿、寫感想時不需要填。</p><dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">時間</dt><dd className="mt-1 font-semibold">{formatDate(activeTrip.startDate)}－{formatDate(activeTrip.endDate)}</dd></div><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">地方</dt><dd className="mt-1 font-semibold">{activeTrip.city}・{activeTrip.country}</dd></div><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">狀態</dt><dd className="mt-1 font-semibold">{isTripPublic(activeTrip) ? "公開" : "私人草稿"}</dd></div><div className="rounded-2xl bg-sky-50 p-4"><dt className="text-xs font-semibold text-zinc-500">系統整理</dt><dd className="mt-1 font-semibold">{activeTrip.places.length} 個地點・{(activeTrip.travelRoute ?? []).length} 段路線</dd></div></dl><details className="mt-6 rounded-2xl border border-sky-100 p-4"><summary className="min-h-11 cursor-pointer py-2 font-semibold text-sky-900">真的需要時才修改基本資料</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="行程名稱" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, title: value }))} value={activeTrip.title} /><Field label="公開網址名稱" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, slug: value }))} value={activeTrip.slug} /><Field label="城市" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, city: value }))} value={activeTrip.city} /><Field label="國家" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, country: value }))} value={activeTrip.country} /><Field label="開始日期" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, startDate: value }))} type="date" value={toDateInput(activeTrip.startDate)} /><Field label="結束日期" onChange={(value) => updateActiveTrip((trip) => ({ ...trip, endDate: value }))} type="date" value={toDateInput(activeTrip.endDate)} /><label className="block sm:col-span-2"><span className="travel-label text-sm font-semibold text-zinc-700">行程簡介</span><textarea className={`${inputClass} min-h-28`} onChange={(event) => updateActiveTrip((trip) => ({ ...trip, summary: event.target.value }))} value={activeTrip.summary} /></label><p className="text-sm leading-7 text-zinc-600 sm:col-span-2">儲存只更新家庭草稿。完成後，請使用上方「公開這篇遊記」或「更新公開版」。</p></div></details></section> : null}
          </div>
        ) : activeTripId ? <div className="rounded-3xl border border-sky-100 bg-white p-8 text-center"><h2 className="travel-display text-2xl font-semibold">{tripLoadError ? "這篇遊記暫時未能載入" : "正在讀取這篇遊記…"}</h2>{tripLoadError ? <button className={`${primaryButtonClass} mt-4`} type="button" onClick={() => setTripReadAttempt(value => value + 1)}>重新讀取這篇</button> : null}</div> : <div><h2 className="travel-display mb-4 text-2xl font-semibold">遊記目錄</h2><div className="grid gap-3 sm:grid-cols-2">{sortedTrips.map(trip => <button key={trip.id} type="button" className="min-w-0 rounded-3xl border border-sky-100 bg-white p-5 text-left shadow-sm hover:bg-sky-50" onClick={() => { setTripLoadError(false); setActiveTripId(trip.id); }}><span className="block break-words text-lg font-semibold">{trip.title}</span><span className="mt-2 block text-sm text-zinc-600">{formatDate(trip.startDate)}</span></button>)}</div>{catalog.length === 0 ? <p>目前沒有行程。</p> : null}</div>}

        {activeTrip ? <EditorLivePreview trip={activeTrip} /> : null}
        <p aria-live="polite" className="editor-status mt-6 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-zinc-600 shadow-sm">{message}<span className="ml-2 text-xs font-normal text-zinc-400">{storeSource === "blob" ? "雲端工作台" : storeSource === "drive" ? "家庭共用儲存" : "初始內容"}</span></p>
      </section>

      {pickerTarget && activeTrip ? <div aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center sm:p-6" role="dialog"><section className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-t-3xl bg-[#f8f3ea] shadow-2xl sm:rounded-3xl"><div className="flex items-start justify-between gap-4 border-b border-sky-100 bg-white px-5 py-4"><div><h2 className="travel-display text-2xl font-semibold">{pickerTarget.kind === "cover" ? "選擇遊記封面" : pickerTarget.kind === "new" ? "系統先挑出尚未使用的照片" : "先看這一段附近的照片"}</h2><p className="mt-1 text-sm text-zinc-600">不用從頭翻相簿。先看少量建議；真的找不到，再查看全部照片。</p></div><button className={secondaryButtonClass} onClick={() => setPickerTarget(null)} type="button">關閉</button></div><div className="max-h-[72vh] overflow-y-auto p-4 sm:p-6"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{pickerPhotos.map((photo) => { const index = activeTrip.photos.findIndex((item) => item.id === photo.id); return <button className="overflow-hidden rounded-2xl border border-sky-100 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-500" key={photo.id} onClick={() => choosePhoto(photo)} type="button"><PhotoThumb className="h-40 sm:h-44" photo={photo} /><span className="block p-3"><span className="block text-xs font-semibold text-sky-700">工作編號 #{index + 1}</span><span className="mt-1 block line-clamp-2 text-sm font-semibold">{photoLabel(photo, index)}</span><span className="mt-1 block text-xs text-zinc-500">{formatPhotoDate(photo)}</span><span className="mt-3 block rounded-full bg-sky-800 px-3 py-2 text-center text-xs font-semibold text-white">選擇這張照片</span></span></button>; })}</div>{!showAllPickerPhotos && activeTrip.photos.length > pickerPhotos.length ? <button className={`${secondaryButtonClass} mt-5 w-full`} onClick={() => setShowAllPickerPhotos(true)} type="button">建議裡沒有，再查看全部 {activeTrip.photos.length} 張</button> : null}{pickerTarget.kind === "new" ? <button className={`${secondaryButtonClass} mt-3 w-full`} onClick={() => choosePhoto(null)} type="button">這一段沒有照片，直接寫一句</button> : null}</div></section></div> : null}

      {activeTripId || dirtyTripIds.size > 0 ? <div className="fixed inset-x-0 bottom-0 z-40 border-t border-sky-100 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:hidden"><button className={`${primaryButtonClass} w-full`} disabled={saving || dirtyTripIds.size === 0} onClick={() => void saveAllChanges()} type="button">{saving ? "儲存中…" : dirtyTripIds.size > 0 ? `儲存全部變更（${dirtyTripIds.size}）` : "全部已儲存"}</button></div> : null}
      </fieldset>
    </main>
  );
}


