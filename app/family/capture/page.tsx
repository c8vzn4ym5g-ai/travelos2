"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { CaptureSpeechLangChips } from "@/app/family/capture-speech-lang";
import { FamilyBackLink } from "@/app/family/family-back";
import { FamGlyph } from "@/app/family/family-icons";
import { MomentAudioPlayer } from "@/app/family/moment-audio-player";
import { SpokenLine } from "@/app/family/spoken-line";
import {
  readStoredCaptureSpeechLang,
  recognitionLangFor,
  startCaptureSpeech,
  writeStoredCaptureSpeechLang,
  type CaptureSpeechLangId,
} from "@/lib/capture-speech";
import {
  CAPTURE_DUMP_LIMIT,
  CAPTURE_UPLOAD_FAILED_MESSAGE,
  captureDumpProgressMessage,
  captureErrorMessage,
  captureUploadWatchdogMs,
  captureVideoHopCount,
  captureVideoPreviewUrl,
  clearMomentAudioInBackground,
  createCaptureMoment,
  createMomentSession,
  createStagedCapturePhotos,
  createTinyPreviewUrl,
  detachStagedCapturePhotos,
  fetchCaptureMoment,
  finalizeCaptureMoment,
  ingestCaptureFileList,
  removeUploadedPhotoInBackground,
  shouldReplaceCaptureDumpRound,
  updateMomentTranscript,
  uploadDisplayPhoto,
  uploadMomentAudio,
  uploadOriginalPhotoInBackground,
} from "@/lib/capture-upload";
import {
  CAPTURE_DOCK_RETRY_GUARD_MS,
  CAPTURE_HANG_SWEEP_MS,
  CAPTURE_PHOTO_HANG_MS,
  CAPTURE_PHOTO_RETRY_LIMIT,
  captureDockCountText,
  captureDockRetryShouldRun,
  captureDockSelectedCount,
  capturePhotoRetryDelayMs,
  captureUploadShouldForceFail,
  clearCaptureRoundMeta,
  createIndexedDbCaptureFileStore,
  listRetryableCapturePhotoIds,
  readCaptureRoundMeta,
  reconcileCapturePhotosWithServer,
  waitForCaptureDockPaint,
  writeCaptureRoundMeta,
  yieldCaptureUi,
  type CaptureRoundMeta,
} from "@/lib/capture-round-store";
import { FAMILY_ADMIN_SESSION_KEY, resolveFamilySession } from "@/lib/family-session";
import { preferredRecorderMime } from "@/lib/moment-audio";
import { preparePlayableAudio, primePlaybackAudioContext } from "@/lib/moment-audio-playback";
import { appendMomentPhotos, classifyCaptureNote, isCaptureVideoFile } from "@/lib/moments";
import type { GeoPoint, TravelJob } from "@/lib/types";

type UploadStatus = "queued" | "uploading" | "uploaded" | "failed";

type StagedPhoto = {
  abort: AbortController;
  errorMessage: string | null;
  file: File;
  hopDone: number;
  hopTotal: number;
  id: string;
  previewUrl: string | null;
  retryCount: number;
  serverPhotoId: string | null;
  status: UploadStatus;
  uploadGeneration: number;
  uploadingSince: number | null;
};

type StagedAudio = {
  abort: AbortController;
  blob: Blob;
  bytes: Uint8Array;
  durationSeconds: number;
  errorMessage: string | null;
  previewUrl: string;
  status: UploadStatus;
  transcript: string;
};

function CaptureVideoThumb({ file, previewUrl }: { file: File; previewUrl: string | null }) {
  const [inlineFailed, setInlineFailed] = useState(false);
  const [open, setOpen] = useState(false);

  if (open && previewUrl) {
    return <video controls playsInline preload="auto" src={previewUrl} />;
  }

  if (previewUrl && !inlineFailed) {
    return (
      <button className="fam-thumb-hit" onClick={() => setOpen(true)} type="button">
        <video
          muted
          onError={() => setInlineFailed(true)}
          playsInline
          preload="metadata"
          src={`${previewUrl}#t=0.001`}
        />
        <span className="fam-sr">播放</span>
      </button>
    );
  }

  return (
    <button className="fam-thumb-fallback fam-thumb-hit" onClick={() => previewUrl && setOpen(true)} type="button">
      <FamGlyph name="play" />
      <p className="line-clamp-3">{file.name}</p>
      <span className="fam-sr">播放</span>
    </button>
  );
}

function sessionPin(fallback: string) {
  return window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? fallback;
}

export default function CapturePage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<StagedPhoto[]>([]);
  const audioRef = useRef<StagedAudio | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const recordStartedAtRef = useRef(0);
  const audioGenerationRef = useRef(0);
  const spokenRef = useRef("");
  const stopSpeechRef = useRef<(() => void) | null>(null);
  const pinRef = useRef("");
  const coordinatesRef = useRef<GeoPoint | null>(null);
  const momentSessionRef = useRef<ReturnType<typeof createMomentSession> | null>(null);
  const photoUploadsRef = useRef(new Map<string, Promise<void>>());
  const liveUploadsRef = useRef(new Set<string>());
  const audioUploadRef = useRef<Promise<void> | null>(null);
  const savingRef = useRef(false);
  const persistTimerRef = useRef<number>(0);
  const finalizedMomentRef = useRef<string | null>(null);
  const noteRef = useRef("");
  const restoringRef = useRef(false);
  const captureFilesRef = useRef(createIndexedDbCaptureFileStore());
  const speechLangRef = useRef<CaptureSpeechLangId>("cmn");
  const [pin, setPin] = useState("");
  const [speechLang, setSpeechLang] = useState<CaptureSpeechLangId>("cmn");
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [ingestHint, setIngestHint] = useState(0);
  const [dockRetryInFlight, setDockRetryInFlight] = useState(false);
  const dockRetryInFlightRef = useRef(false);
  const dockRetryStartedAtRef = useRef<number | null>(null);
  const dockRetryGuardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [note, setNote] = useState("");
  const [audio, setAudio] = useState<StagedAudio | null>(null);
  const [audioHold, setAudioHold] = useState<{ durationSeconds: number } | null>(null);
  const [spoken, setSpoken] = useState("");
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [savedMomentId, setSavedMomentId] = useState<string | null>(null);
  const [message, setMessage] = useState("選了就會進工作台。清楚的照片就是已經收到。");

  useEffect(() => {
    let cancelled = false;

    void resolveFamilySession().then((session) => {
      if (cancelled) {
        return;
      }

      if (session.allowed) {
        setPin(session.pin);
        pinRef.current = session.pin;
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

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  useEffect(() => {
    pinRef.current = pin;
  }, [pin]);

  useEffect(() => {
    const stored = readStoredCaptureSpeechLang(window.localStorage);
    speechLangRef.current = stored;
    setSpeechLang(stored);
  }, []);

  useEffect(() => {
    return () => {
      window.clearTimeout(persistTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!authenticated || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        coordinatesRef.current = next;
      },
      () => {
        // Capture still works without GPS.
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 4000 },
    );
  }, [authenticated]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    audioRef.current = audio;
  }, [audio]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    void restoreCaptureRound();
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    const onHide = () => persistCaptureRound();
    const onVisible = () => {
      if (document.visibilityState !== "visible") {
        persistCaptureRound();
        return;
      }
      sweepHungUploads();
      void reconcileCaptureRoundFromServer().then(() => maybeAutoFinalize());
      for (const photo of photosRef.current) {
        if (photo.status === "uploaded") {
          continue;
        }
        if (liveUploadsRef.current.has(photo.id)) {
          continue;
        }
        void startBackgroundPhotoUpload(photo);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pagehide", onHide);
    };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }
    const timer = window.setInterval(() => {
      sweepHungUploads();
    }, CAPTURE_HANG_SWEEP_MS);
    sweepHungUploads();
    return () => window.clearInterval(timer);
  }, [authenticated]);

  useEffect(() => {
    return () => {
      for (const photo of photosRef.current) {
        if (photo.previewUrl) {
          URL.revokeObjectURL(photo.previewUrl);
        }
      }
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.previewUrl);
      }
      recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function createLiveMomentSession() {
    return createMomentSession((time, momentId) =>
      createCaptureMoment({
        coordinates: coordinatesRef.current,
        id: momentId,
        pin: sessionPin(pinRef.current),
        time,
      }),
    );
  }

  function momentSession() {
    momentSessionRef.current ??= createLiveMomentSession();
    return momentSessionRef.current;
  }

  function resetDraft() {
    momentSession().reset();
    photoUploadsRef.current = new Map();
    audioUploadRef.current = null;
    finalizedMomentRef.current = null;
    releaseDockRetryGuard();
  }

  function captureRoundMeta(): CaptureRoundMeta {
    return {
      momentId: momentSessionRef.current?.momentId ?? null,
      note: noteRef.current,
      photos: photosRef.current.map((photo) => ({
        id: photo.id,
        lastModified: photo.file.lastModified,
        name: photo.file.name,
        retryCount: photo.retryCount,
        serverPhotoId: photo.serverPhotoId,
        size: photo.file.size,
        status: photo.status,
        type: photo.file.type,
      })),
      v: 1,
    };
  }

  function persistCaptureRound() {
    writeCaptureRoundMeta(captureRoundMeta(), window.localStorage);
  }

  async function persistCapturePhotoFile(photo: StagedPhoto) {
    await captureFilesRef.current.put(photo.id, photo.file);
    persistCaptureRound();
  }

  async function clearCaptureRound() {
    clearCaptureRoundMeta(window.localStorage);
    await captureFilesRef.current.clear();
  }

  function beginFreshDumpRound() {
    photosRef.current = detachStagedCapturePhotos(photosRef.current);
    setPhotos(() => photosRef.current);
    photoUploadsRef.current = new Map();
    releaseDockRetryGuard();
    finalizedMomentRef.current = null;
    momentSessionRef.current = createLiveMomentSession();
    void clearCaptureRound();
  }

  async function ensureMoment(time: string) {
    return momentSession().ensure(time);
  }

  async function retryMoment(
    time: string,
    status: number,
    session = momentSession(),
  ) {
    if (status === 404) {
      session.invalidate();
    }
    return session.ensure(time);
  }

  function maybeAutoFinalize() {
    const list = photosRef.current;
    if (list.length === 0) {
      return;
    }
    if (list.some((photo) => photo.status === "queued" || photo.status === "uploading")) {
      return;
    }
    const landed = list.filter((photo) => photo.status === "uploaded").length;
    if (landed === 0) {
      return;
    }
    const momentId = momentSession().momentId;
    if (!momentId || finalizedMomentRef.current === momentId) {
      return;
    }
    finalizedMomentRef.current = momentId;
    const classified = classifyCaptureNote(noteRef.current);
    const time = list[0]?.file.lastModified
      ? new Date(list[0].file.lastModified).toISOString()
      : new Date().toISOString();
    void finalizeCaptureMoment({
      command: classified.command,
      coordinates: coordinatesRef.current,
      momentId,
      note: classified.note,
      pin: sessionPin(pinRef.current),
      time,
      transcript: spokenRef.current || audioRef.current?.transcript || null,
    }).then((saved) => {
      setSavedJobId(saved.job?.id ?? null);
      setSavedMomentId(saved.moment?.id ?? momentId);
      const failed = list.filter((photo) => photo.status === "failed").length;
      setMessage(
        failed > 0
          ? `已進工作台 ${landed} 張。還有幾張會再送。`
          : `已進工作台 ${landed} 張。可離開。`,
      );
      persistCaptureRound();
    }).catch(() => {
      finalizedMomentRef.current = null;
    });
  }

  function failHungPhoto(photoId: string, generation?: number) {
    const current = photosRef.current.find((photo) => photo.id === photoId);
    if (!current) {
      return;
    }
    if (generation != null && current.uploadGeneration !== generation) {
      return;
    }
    if (current.status === "uploaded") {
      return;
    }
    current.abort.abort();
    liveUploadsRef.current.delete(photoId);
    photoUploadsRef.current.delete(photoId);
    if (current.previewUrl) {
      URL.revokeObjectURL(current.previewUrl);
    }
    patchPhoto(photoId, {
      errorMessage: CAPTURE_UPLOAD_FAILED_MESSAGE,
      previewUrl: null,
      status: "failed",
      uploadingSince: null,
    });
    persistCaptureRound();
    setMessage("還有幾張在這一輪。點刷新就可以，不用重選相簿。");
  }

  function sweepHungUploads() {
    const now = Date.now();
    let flipped = false;
    for (const photo of photosRef.current) {
      const hangMs = isCaptureVideoFile(photo.file)
        ? captureUploadWatchdogMs(photo.file.size)
        : CAPTURE_PHOTO_HANG_MS;
      if (
        !captureUploadShouldForceFail({
          hasLiveUpload: liveUploadsRef.current.has(photo.id),
          hangMs,
          now,
          status: photo.status,
          uploadingSince: photo.uploadingSince,
        })
      ) {
        continue;
      }
      failHungPhoto(photo.id);
      flipped = true;
    }
    if (flipped) {
      const stillBusy = photosRef.current.some(
        (photo) => photo.status === "queued" || photo.status === "uploading",
      );
      if (!stillBusy) {
        releaseDockRetryGuard();
      }
      void reconcileCaptureRoundFromServer().then(() => maybeAutoFinalize());
    }
  }

  async function reconcileCaptureRoundFromServer() {
    const momentId = momentSession().momentId;
    if (!momentId) {
      return;
    }
    const moment = await fetchCaptureMoment(momentId, sessionPin(pinRef.current));
    if (!moment?.photos?.length) {
      return;
    }
    const reconciled = reconcileCapturePhotosWithServer(photosRef.current, moment.photos);
    const changed = reconciled.some((photo, index) => {
      const current = photosRef.current[index];
      return photo.status !== current?.status || photo.serverPhotoId !== current?.serverPhotoId;
    });
    if (!changed) {
      return;
    }
    for (const photo of reconciled) {
      if (photo.status === "uploaded") {
        photo.abort.abort();
        liveUploadsRef.current.delete(photo.id);
      }
    }
    photosRef.current = reconciled;
    setPhotos(reconciled);
    persistCaptureRound();
  }

  async function restoreCaptureRound() {
    if (restoringRef.current || photosRef.current.length > 0) {
      return;
    }
    restoringRef.current = true;
    try {
      const meta = readCaptureRoundMeta(window.localStorage);
      if (!meta || meta.photos.length === 0) {
        return;
      }
      if (meta.momentId) {
        momentSession().adopt(meta.momentId);
      }
      if (meta.note) {
        setNote(meta.note);
      }
      const restored: StagedPhoto[] = [];
      for (const item of meta.photos) {
        const file = await captureFilesRef.current.get(item.id);
        if (!file && item.status !== "uploaded") {
          continue;
        }
        const staged: StagedPhoto = {
          abort: new AbortController(),
          errorMessage: null,
          file: file ?? new File([], item.name, { lastModified: item.lastModified, type: item.type }),
          hopDone: 0,
          hopTotal: 0,
          id: item.id,
          previewUrl:
            item.status === "uploaded" && file && !file.type.startsWith("video")
              ? URL.createObjectURL(file)
              : item.status === "uploaded" && file
                ? captureVideoPreviewUrl(file)
                : null,
          retryCount: item.retryCount,
          serverPhotoId: item.serverPhotoId,
          status: item.status === "uploaded" && item.serverPhotoId ? "uploaded" : file ? "queued" : "failed",
          uploadGeneration: 0,
          uploadingSince: item.status === "uploaded" && item.serverPhotoId ? null : Date.now(),
        };
        restored.push(staged);
      }
      if (restored.length === 0) {
        return;
      }
      photosRef.current = restored;
      setPhotos(restored);
      setMessage("還有這一輪，會繼續收。");
      setSavedMomentId(meta.momentId);
      try {
        await reconcileCaptureRoundFromServer();
      } catch {
        /* keep restored local state */
      }
      for (const photo of photosRef.current) {
        if (photo.status !== "uploaded") {
          void startBackgroundPhotoUpload(photo);
        }
      }
      maybeAutoFinalize();
    } finally {
      restoringRef.current = false;
    }
  }

  function persistSpokenLine(next: string) {
    const momentId = momentSessionRef.current?.momentId;
    if (!momentId) {
      return;
    }

    window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      void updateMomentTranscript({
        momentId,
        pin: sessionPin(pinRef.current),
        transcript: next,
      }).catch(() => {
        // Optional note still writes the latest spoken line.
      });
    }, 400);
  }

  function applySpokenEdit(next: string) {
    spokenRef.current = next;
    setSpoken(next);
    setAudio((current) => {
      if (!current) {
        return current;
      }
      const updated = { ...current, transcript: next };
      audioRef.current = updated;
      return updated;
    });
  }

  function commitSpokenEdit(next: string) {
    applySpokenEdit(next);
    persistSpokenLine(next);
  }

  function beginLiveSpeech() {
    stopSpeechRef.current?.();
    stopSpeechRef.current = startCaptureSpeech(
      (text) => {
        spokenRef.current = text;
        setSpoken(text);
      },
      { lang: recognitionLangFor(speechLangRef.current) },
    ).stop;
  }

  function chooseSpeechLang(next: CaptureSpeechLangId) {
    speechLangRef.current = next;
    setSpeechLang(next);
    writeStoredCaptureSpeechLang(next, window.localStorage);
    if (recording) {
      beginLiveSpeech();
    }
  }

  function photoIsOnScreen(photoId: string) {
    return photosRef.current.some((photo) => photo.id === photoId);
  }

  function patchPhoto(photoId: string, patch: Partial<StagedPhoto>) {
    setPhotos((current) => {
      if (!current.some((photo) => photo.id === photoId)) {
        if (patch.previewUrl) {
          URL.revokeObjectURL(patch.previewUrl);
        }
        return current;
      }
      const next = current.map((photo) => {
        if (photo.id !== photoId) {
          return photo;
        }
        if (patch.previewUrl && photo.previewUrl && patch.previewUrl !== photo.previewUrl) {
          URL.revokeObjectURL(photo.previewUrl);
        }
        return { ...photo, ...patch };
      });
      photosRef.current = next;
      return next;
    });
  }

  async function startBackgroundPhotoUpload(photo: StagedPhoto) {
    liveUploadsRef.current.add(photo.id);
    const session = momentSession();
    const generation =
      (photosRef.current.find((item) => item.id === photo.id)?.uploadGeneration ?? photo.uploadGeneration ?? 0) + 1;
    const applyGeneration = (list: StagedPhoto[]) =>
      list.map((item) =>
        item.id === photo.id
          ? {
              ...item,
              abort: photo.abort,
              errorMessage: null,
              file: photo.file,
              retryCount: photo.retryCount,
              status: "uploading" as const,
              uploadGeneration: generation,
              uploadingSince: item.uploadingSince ?? Date.now(),
            }
          : item,
      );
    if (photosRef.current.some((item) => item.id === photo.id)) {
      photosRef.current = applyGeneration(photosRef.current);
    }
    setPhotos((current) => {
      if (!current.some((item) => item.id === photo.id)) {
        return current;
      }
      const next = applyGeneration(current);
      photosRef.current = next;
      return next;
    });
    const stillThisRun = () =>
      photosRef.current.find((item) => item.id === photo.id)?.uploadGeneration === generation;
    const run = (async () => {
      await yieldCaptureUi(0);
      if (photo.abort.signal.aborted || !stillThisRun()) {
        return;
      }

      persistCaptureRound();
      let watchdogFired = false;
      const watchdogMs = isCaptureVideoFile(photo.file)
        ? captureUploadWatchdogMs(photo.file.size)
        : CAPTURE_PHOTO_HANG_MS;
      const watchdog = globalThis.setTimeout(() => {
        watchdogFired = true;
        if (!photo.abort.signal.aborted) {
          photo.abort.abort();
        }
        failHungPhoto(photo.id, generation);
      }, watchdogMs);
      try {
        const takenAt = Number.isFinite(photo.file.lastModified)
          ? new Date(photo.file.lastModified).toISOString()
          : new Date().toISOString();
        const momentId = session.allocate(takenAt);
        persistCaptureRound();
        const video = isCaptureVideoFile(photo.file);
        if (!video) {
          await Promise.race([
            session.ensure(takenAt),
            new Promise<string>((_, reject) => {
              const onAbort = () => reject(new Error(CAPTURE_UPLOAD_FAILED_MESSAGE));
              if (photo.abort.signal.aborted) {
                onAbort();
                return;
              }
              photo.abort.signal.addEventListener("abort", onAbort, { once: true });
            }),
          ]);
        }
        if (!stillThisRun()) {
          return;
        }
        if (photo.abort.signal.aborted && !watchdogFired) {
          return;
        }

        const uploaded = await uploadDisplayPhoto({
          coordinates: coordinatesRef.current,
          file: photo.file,
          momentId,
          onHopProgress: (hopDone, hopTotal) => {
            if (stillThisRun()) {
              patchPhoto(photo.id, { hopDone, hopTotal, status: "uploading" });
            }
          },
          startMoment: video ? () => session.ensure(takenAt) : undefined,
          onDisplayReady: async (display) => {
            if (photo.abort.signal.aborted || isCaptureVideoFile(photo.file) || !stillThisRun()) {
              return;
            }
            const previewUrl = await createTinyPreviewUrl(display);
            if (!previewUrl) {
              return;
            }
            const latest = photosRef.current.find((item) => item.id === photo.id);
            if (!latest || latest.status === "failed" || latest.uploadGeneration !== generation) {
              URL.revokeObjectURL(previewUrl);
              return;
            }
            patchPhoto(photo.id, { previewUrl });
          },
          pin: sessionPin(pinRef.current),
          retryMoment: (status) => retryMoment(takenAt, status, session),
          signal: photo.abort.signal,
          takenAt,
        });

        if (!stillThisRun()) {
          return;
        }

        if (uploaded.photo?.id) {
          patchPhoto(photo.id, { errorMessage: null, serverPhotoId: uploaded.photo.id, status: "uploaded" });
          persistCaptureRound();
          uploadOriginalPhotoInBackground({
            display: uploaded.display,
            momentId: uploaded.momentId,
            original: photo.file,
            photoId: uploaded.photo.id,
            pin: sessionPin(pinRef.current),
          });
          maybeAutoFinalize();
          return;
        }

        throw new Error(CAPTURE_UPLOAD_FAILED_MESSAGE);
      } catch (error) {
        if (!photoIsOnScreen(photo.id) || !stillThisRun()) {
          return;
        }
        if (watchdogFired) {
          failHungPhoto(photo.id, generation);
          return;
        }
        if (photo.abort.signal.aborted) {
          return;
        }
        const current = photosRef.current.find((item) => item.id === photo.id);
        if (current?.status === "uploaded" || current?.status === "failed") {
          return;
        }
        const attempt = (current?.retryCount ?? photo.retryCount ?? 0) + 1;
        if (attempt <= CAPTURE_PHOTO_RETRY_LIMIT && stillThisRun()) {
          const nextAbort = new AbortController();
          patchPhoto(photo.id, {
            abort: nextAbort,
            errorMessage: null,
            retryCount: attempt,
            status: "uploading",
          });
          persistCaptureRound();
          await new Promise((resolve) => globalThis.setTimeout(resolve, capturePhotoRetryDelayMs(attempt)));
          if (!stillThisRun()) {
            return;
          }
          const latest = photosRef.current.find((item) => item.id === photo.id);
          if (!latest || latest.status === "uploaded") {
            return;
          }
          void startBackgroundPhotoUpload({ ...latest, abort: nextAbort, retryCount: attempt });
          return;
        }
        const detail = captureErrorMessage(error, CAPTURE_UPLOAD_FAILED_MESSAGE);
        const currentPreview = photosRef.current.find((item) => item.id === photo.id)?.previewUrl;
        if (currentPreview) {
          URL.revokeObjectURL(currentPreview);
        }
        patchPhoto(photo.id, {
          errorMessage: detail,
          previewUrl: null,
          retryCount: attempt,
          status: "failed",
        });
        persistCaptureRound();
        setMessage("還有幾張在這一輪。點刷新就可以，不用重選相簿。");
      } finally {
        globalThis.clearTimeout(watchdog);
      }
    })();

    photoUploadsRef.current.set(photo.id, run.then(() => undefined, () => undefined));
    void run.then(
      () => {
        if (photosRef.current.find((item) => item.id === photo.id)?.uploadGeneration === generation) {
          liveUploadsRef.current.delete(photo.id);
        }
      },
      () => {
        if (photosRef.current.find((item) => item.id === photo.id)?.uploadGeneration === generation) {
          liveUploadsRef.current.delete(photo.id);
        }
      },
    );
    return run;
  }

  async function startBackgroundAudioUpload(staged: StagedAudio) {
    const run = (async () => {
      const recordedAt = new Date().toISOString();
      try {
        const momentId = await ensureMoment(recordedAt);
        if (staged.abort.signal.aborted) {
          return;
        }

        const sentTranscript = spokenRef.current || staged.transcript;
        await uploadMomentAudio({
          blob: staged.blob,
          momentId,
          pin: sessionPin(pinRef.current),
          retryMoment: (status) => retryMoment(recordedAt, status),
          signal: staged.abort.signal,
          transcript: sentTranscript,
        });

        if (staged.abort.signal.aborted) {
          clearMomentAudioInBackground({
            momentId: momentSession().momentId ?? momentId,
            pin: sessionPin(pinRef.current),
          });
          return;
        }

        setAudio((current) => {
          if (current?.previewUrl !== staged.previewUrl) {
            return current;
          }
          const next = {
            ...current,
            errorMessage: null,
            status: "uploaded" as const,
            transcript: spokenRef.current || current.transcript,
          };
          audioRef.current = next;
          return next;
        });
        persistSpokenLine(spokenRef.current);
      } catch (error) {
        if (staged.abort.signal.aborted) {
          return;
        }
        const detail = captureErrorMessage(error, "上傳失敗。");
        setAudio((current) => {
          if (current?.previewUrl !== staged.previewUrl) {
            return current;
          }
          const next = { ...current, errorMessage: detail, status: "failed" as const };
          audioRef.current = next;
          return next;
        });
        setMessage("聲音還沒進倉。照片還在這一輪。");
        throw error;
      }
    })();

    audioUploadRef.current = run.then(() => undefined, () => undefined);
    return run;
  }

  async function addIncomingFiles(
    fileList: FileList | null,
    input: HTMLInputElement | undefined,
    source: "choose-photos" | "take-photo",
  ) {
    const fileListLength = fileList?.length ?? 0;
    if (fileListLength === 0) {
      return;
    }

    const freshRound = shouldReplaceCaptureDumpRound(source, photosRef.current.length);
    if (freshRound) {
      beginFreshDumpRound();
    }

    const incomingCount = fileListLength;
    // Cite input.files.length on Confirm. Apple’s 加入 (n) is not readable from the web.
    flushSync(() => {
      setIngestHint(freshRound ? incomingCount : photosRef.current.length + incomingCount);
      setMessage(
        captureDumpProgressMessage(
          fileListLength,
          photosRef.current.length + Math.min(fileListLength, CAPTURE_DUMP_LIMIT),
          { freshRound },
        ),
      );
    });
    await waitForCaptureDockPaint();

    try {
      await ingestCaptureFileList(fileList, {
      limit: CAPTURE_DUMP_LIMIT,
      async onCopied(file, progress) {
        const incoming = createStagedCapturePhotos([file]).map((draft) => ({
          ...draft,
          abort: new AbortController(),
          hopDone: 0,
          hopTotal: isCaptureVideoFile(file) ? captureVideoHopCount(file.size) : 0,
          previewUrl: isCaptureVideoFile(file) ? captureVideoPreviewUrl(file) : null,
          retryCount: 0,
          uploadGeneration: 0,
          uploadingSince: Date.now(),
        }));
        if (incoming.length === 0) {
          return;
        }

        const session = momentSession();
        session.allocate(
          Number.isFinite(file.lastModified) ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
        );
        void session.ensure(
          Number.isFinite(file.lastModified) ? new Date(file.lastModified).toISOString() : new Date().toISOString(),
        ).catch(() => {
          // Photo POST retries moment create if this first ensure is still in flight.
        });

        const next = appendMomentPhotos(photosRef.current, incoming);
        photosRef.current = next;
        setPhotos(next);
        setMessage(captureDumpProgressMessage(progress.fileListLength, next.length, { freshRound }));
        persistCaptureRound();

        for (const photo of incoming) {
          void persistCapturePhotoFile(photo);
          void startBackgroundPhotoUpload(photo);
        }
        await yieldCaptureUi();
      },
      onReceived(received) {
        setMessage(
          captureDumpProgressMessage(received, photosRef.current.length + received, { freshRound }),
        );
      },
      resetInput() {
        if (input && input.files === fileList) {
          input.value = "";
        }
      },
    });
    } finally {
      if (input && input.files === fileList) {
        input.value = "";
      }
      await waitForCaptureDockPaint();
      setIngestHint(0);
    }
  }

  function onTakePhoto(event: React.ChangeEvent<HTMLInputElement>) {
    void addIncomingFiles(event.target.files, event.target, "take-photo");
  }

  function onChoosePhotos(event: React.ChangeEvent<HTMLInputElement>) {
    void addIncomingFiles(event.target.files, event.target, "choose-photos");
  }

  function removePhoto(photoId: string) {
    setPhotos((current) => {
      const removed = current.find((photo) => photo.id === photoId);
      if (removed) {
        removed.abort.abort();
        if (removed.previewUrl) {
          URL.revokeObjectURL(removed.previewUrl);
        }
        photoUploadsRef.current.delete(photoId);
        const savedMomentId = momentSession().momentId;
        if (removed.serverPhotoId && savedMomentId) {
          removeUploadedPhotoInBackground({
            momentId: savedMomentId,
            photoId: removed.serverPhotoId,
            pin: sessionPin(pinRef.current),
          });
        }
      }
      const next = current.filter((photo) => photo.id !== photoId);
      photosRef.current = next;
      persistCaptureRound();
      return next;
    });
  }

  function beginStagedPhotoRetry(photo: StagedPhoto) {
    photo.abort.abort();
    const nextAbort = new AbortController();
    const next: StagedPhoto = {
      ...photo,
      abort: nextAbort,
      errorMessage: null,
      retryCount: 0,
      status: "uploading",
      uploadingSince: Date.now(),
    };
    photosRef.current = photosRef.current.map((item) => (item.id === photo.id ? next : item));
    setPhotos(photosRef.current);
    persistCaptureRound();
    void startBackgroundPhotoUpload(next);
  }

  function retryPhoto(photoId: string) {
    const photo = photosRef.current.find((item) => item.id === photoId);
    if (!photo || photo.status === "uploaded") {
      return Promise.resolve();
    }
    if (photo.file.size > 0) {
      beginStagedPhotoRetry(photo);
      return Promise.resolve();
    }
    return captureFilesRef.current.get(photoId).then((stored) => {
      const latest = photosRef.current.find((item) => item.id === photoId);
      if (!latest || latest.status === "uploaded") {
        return;
      }
      if (!stored?.size) {
        failHungPhoto(latest.id);
        return;
      }
      beginStagedPhotoRetry({ ...latest, file: stored });
    });
  }

  function pressDockRetry(event: React.PointerEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    button.classList.add("is-pressed");
    globalThis.setTimeout(() => button.classList.remove("is-pressed"), 180);
  }

  function releaseDockRetryGuard() {
    if (dockRetryGuardTimerRef.current) {
      globalThis.clearTimeout(dockRetryGuardTimerRef.current);
      dockRetryGuardTimerRef.current = null;
    }
    dockRetryInFlightRef.current = false;
    dockRetryStartedAtRef.current = null;
    setDockRetryInFlight(false);
  }

  function armDockRetryGuard() {
    if (dockRetryGuardTimerRef.current) {
      globalThis.clearTimeout(dockRetryGuardTimerRef.current);
    }
    dockRetryInFlightRef.current = true;
    dockRetryStartedAtRef.current = Date.now();
    setDockRetryInFlight(true);
    dockRetryGuardTimerRef.current = globalThis.setTimeout(() => {
      dockRetryGuardTimerRef.current = null;
      dockRetryInFlightRef.current = false;
      dockRetryStartedAtRef.current = null;
      setDockRetryInFlight(false);
    }, CAPTURE_DOCK_RETRY_GUARD_MS);
  }

  function retryFailedPhotos() {
    const ids = listRetryableCapturePhotoIds(photosRef.current);
    if (
      !captureDockRetryShouldRun(
        dockRetryInFlightRef.current,
        ids.length,
        dockRetryStartedAtRef.current,
      )
    ) {
      if (ids.length === 0) {
        void reconcileCaptureRoundFromServer().then(() => maybeAutoFinalize());
      }
      return;
    }
    armDockRetryGuard();
    setMessage(`正在再送 ${ids.length} 張。還是這一輪，不用重選相簿。`);
    void (async () => {
      try {
        await yieldCaptureUi(0);
        for (const photo of photosRef.current) {
          if (photo.status === "uploaded") {
            continue;
          }
          photo.abort.abort();
          liveUploadsRef.current.delete(photo.id);
          photoUploadsRef.current.delete(photo.id);
        }
        try {
          await reconcileCaptureRoundFromServer();
        } catch {
          /* keep local retry state */
        }
        const still = listRetryableCapturePhotoIds(photosRef.current);
        if (still.length === 0) {
          maybeAutoFinalize();
          return;
        }
        setMessage(`正在再送 ${still.length} 張。還是這一輪，不用重選相簿。`);
        for (const id of still) {
          const photo = photosRef.current.find((item) => item.id === id);
          if (!photo || photo.status === "uploaded") {
            continue;
          }
          void retryPhoto(id);
          await yieldCaptureUi(0);
        }
        try {
          await reconcileCaptureRoundFromServer();
        } catch {
          /* keep local retry state */
        }
        maybeAutoFinalize();
      } finally {
        releaseDockRetryGuard();
      }
    })();
  }

  function retakePhoto(photoId: string) {
    removePhoto(photoId);
    cameraInputRef.current?.click();
  }

  function clearAudio() {
    audioGenerationRef.current += 1;
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
    spokenRef.current = "";
    setSpoken("");
    setAudioHold(null);
    if (!audio) {
      return;
    }

    audio.abort.abort();
    URL.revokeObjectURL(audio.previewUrl);
    audioUploadRef.current = null;
    const savedMomentId = momentSession().momentId;
    if (savedMomentId) {
      clearMomentAudioInBackground({ momentId: savedMomentId, pin: sessionPin(pinRef.current) });
    }
    setAudio(null);
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("這台裝置現在不能錄音。");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorderMime = preferredRecorderMime();
      const recorder = recorderMime
        ? new MediaRecorder(stream, { mimeType: recorderMime })
        : new MediaRecorder(stream);
      chunksRef.current = [];
      const generation = audioGenerationRef.current;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const durationSeconds = Math.max(1, Math.round((Date.now() - recordStartedAtRef.current) / 1000));
        setAudioHold({ durationSeconds });
        const raw = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        void (async () => {
          const prepared = await preparePlayableAudio(raw);
          const previewUrl = URL.createObjectURL(prepared.file);
          if (generation !== audioGenerationRef.current) {
            URL.revokeObjectURL(previewUrl);
            return;
          }
          if (audioRef.current) {
            audioRef.current.abort.abort();
            URL.revokeObjectURL(audioRef.current.previewUrl);
          }
          const staged: StagedAudio = {
            abort: new AbortController(),
            blob: prepared.file,
            bytes: prepared.bytes,
            durationSeconds: prepared.durationSeconds ?? durationSeconds,
            errorMessage: null,
            previewUrl,
            status: "uploading",
            transcript: spokenRef.current,
          };
          setAudio(staged);
          setAudioHold(null);
          setMessage("聽一下剛錄的。若是雜音就重錄。聲音已開始上傳。");
          void startBackgroundAudioUpload(staged);
        })();
      };
      recorderRef.current = recorder;
      recordStartedAtRef.current = Date.now();
      spokenRef.current = "";
      setSpoken("");
      beginLiveSpeech();
      primePlaybackAudioContext();
      recorder.start();
      setRecording(true);
      setMessage("正在錄音…");
    } catch {
      setMessage("沒有麥克風權限，照片與心情仍可儲存。");
    }
  }

  function stopRecording() {
    primePlaybackAudioContext();
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
    const durationSeconds = Math.max(1, Math.round((Date.now() - recordStartedAtRef.current) / 1000));
    setAudioHold({ durationSeconds });
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function retakeAudio() {
    if (recording) {
      recorderRef.current?.stop();
      recorderRef.current = null;
      setRecording(false);
    }
    clearAudio();
    void startRecording();
  }

  async function saveMoment() {
    if (!note.trim() && !spoken.trim()) {
      setMessage("照片選了就會進工作台。這格只是補一句心情，可不用按。");
      return;
    }

    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setMessage("正在寫下這一句…");

    try {
      const classified = classifyCaptureNote(note);
      const time = photos[0]?.file.lastModified
        ? new Date(photos[0].file.lastModified).toISOString()
        : new Date().toISOString();

      let createdJob: TravelJob | null = null;
      let keptMomentId = momentSession().momentId ?? (await ensureMoment(time));
      const saved = await finalizeCaptureMoment({
        command: classified.command,
        coordinates: coordinatesRef.current,
        momentId: keptMomentId,
        note: classified.note,
        pin: sessionPin(pinRef.current),
        time,
        transcript: spokenRef.current || audioRef.current?.transcript || null,
      });
      createdJob = saved.job;
      keptMomentId = saved.moment?.id ?? keptMomentId;

      setSavedJobId(createdJob?.id ?? null);
      setSavedMomentId(keptMomentId);
      persistCaptureRound();
      setMessage("這一句已寫上。照片還在這一輪，不用再等。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "這一句沒寫上，請再試一次。");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!authenticated) {
    return (
      <main className="fam-page fam-page-capture">
        <div className="fam-splash">
          <div className="fam-splash-card">
            <p className="fam-label">{redirecting ? "正在返回家庭登入…" : "正在開啟 Capture…"}</p>
            <p className="fam-muted mt-3">
              {redirecting ? "Capture 使用同一個家庭密碼，不會另外開密碼表單。" : "家庭入口開啟中，不必先輸入密碼。"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="fam-page fam-page-capture">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <FamilyBackLink className="min-h-11" href="/family">
            ← 家庭入口
          </FamilyBackLink>
          <p className="fam-script">one capture door</p>
          <h1 className="fam-title">Capture</h1>
          <p className="fam-lede">
            打開就能拍或選。清楚看見的就是已經收到，會進工作台。傳的時候轉圈。還沒好的點刷新就可以，不用重選相簿。這一輪最多 40 張。再選一次相簿是新的一輪。一句話可以補心情，也可以交代工作，可不用按。
          </p>
        </div>
      </header>

      <div
        className="fam-dock-count"
        data-capture-dock-count=""
        data-capture-dock-n={captureDockSelectedCount(photos.length, ingestHint)}
      >
        <p>{captureDockCountText(photos, ingestHint)}</p>
        <button
          aria-busy={dockRetryInFlight}
          aria-label="再送"
          className="fam-dock-retry"
          data-capture-retry-busy={dockRetryInFlight ? "" : undefined}
          data-capture-retry-failed=""
          onClick={retryFailedPhotos}
          onPointerDown={pressDockRetry}
          type="button"
        >
          <span className={dockRetryInFlight ? "fam-dock-retry-glyph is-busy" : "fam-dock-retry-glyph"}>
            <FamGlyph name="refresh" size={22} />
          </span>
        </button>
      </div>

      <section className="fam-sheet">
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="fam-file fam-pill fam-pill-blush-outline">
            <span>拍照</span>
            <span className="fam-en">Take Photo</span>
            <input accept="image/*" capture="environment" onChange={onTakePhoto} ref={cameraInputRef} type="file" />
          </label>
          <label className="fam-file fam-pill fam-pill-blush">
            <span>選照片或影片</span>
            <span className="fam-en">Choose from album</span>
            <input
              accept="image/*,video/*,.heic,.heif,.mov,.mp4,.m4v"
              multiple
              onChange={onChoosePhotos}
              type="file"
            />
          </label>
        </div>
        <p className="fam-muted mt-3">加入之後兩個按鈕都還在。拍照會接在這一輪後面。再選一次相簿是新的一輪。</p>

        {photos.length > 0 ? (
          <>
            <ul className="mt-5 grid grid-cols-2 gap-3">
              {photos.map((photo) => {
                if (photo.status === "failed") {
                  return (
                    <li className="fam-thumb fam-thumb-fail" key={photo.id}>
                      <button
                        aria-label="再送"
                        className="fam-thumb-fail-hit"
                        onClick={() => retryPhoto(photo.id)}
                        type="button"
                      >
                        <FamGlyph name="refresh" size={36} />
                      </button>
                      <div className="fam-thumb-actions">
                        <button onClick={() => retakePhoto(photo.id)} type="button">
                          重拍
                        </button>
                        <button onClick={() => removePhoto(photo.id)} type="button">
                          移除
                        </button>
                      </div>
                    </li>
                  );
                }
                if (photo.status !== "uploaded") {
                  return (
                    <li className="fam-thumb fam-thumb-pending" key={photo.id}>
                      <button
                        aria-label="再送"
                        className="fam-thumb-fail-hit"
                        onClick={() => retryPhoto(photo.id)}
                        type="button"
                      >
                        <span className="fam-spin" />
                        <span className="fam-sr">上傳中</span>
                        <FamGlyph name="refresh" size={22} />
                      </button>
                      {photo.hopTotal > 0 && photo.hopDone > 0 ? (
                        <span className="fam-chip fam-chip-honey">{photo.hopDone}/{photo.hopTotal}</span>
                      ) : null}
                      <div className="fam-thumb-actions">
                        <button onClick={() => retakePhoto(photo.id)} type="button">
                          重拍
                        </button>
                        <button onClick={() => removePhoto(photo.id)} type="button">
                          移除
                        </button>
                      </div>
                    </li>
                  );
                }
                return (
                  <li className="fam-thumb" key={photo.id}>
                    {isCaptureVideoFile(photo.file) ? (
                      <CaptureVideoThumb file={photo.file} previewUrl={photo.previewUrl} />
                    ) : photo.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={photo.previewUrl} />
                    ) : (
                      <div className="fam-thumb-fallback">
                        <p className="line-clamp-3">{photo.file.name}</p>
                      </div>
                    )}
                    <div className="fam-thumb-actions">
                      <button onClick={() => retakePhoto(photo.id)} type="button">
                        重拍
                      </button>
                      <button onClick={() => removePhoto(photo.id)} type="button">
                        移除
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="fam-muted mt-3">一次選好，一起傳。不是 3 張一排隊。</p>
          </>
        ) : (
          <div className="fam-empty mt-5">
            <p className="fam-label">預覽</p>
            <p className="fam-en">Preview</p>
            <p className="fam-muted mt-2">剛拍的會出現在這裡。</p>
          </div>
        )}

        <div className="fam-audio mt-5">
          <div>
            <p className="fam-label">聲音 / Audio</p>
            <p className="fam-muted mt-1">先點語言，再點圓鈕說話。</p>
            <CaptureSpeechLangChips onChange={chooseSpeechLang} value={speechLang} />
          </div>
          {recording ? (
            <button className="fam-mic fam-mic-live" onClick={stopRecording} type="button">
              <FamGlyph name="mic" />
              <span className="fam-sr">Stop</span>
            </button>
          ) : (
            <button className="fam-mic" onClick={() => void startRecording()} type="button">
              <FamGlyph name="mic" />
              <span className="fam-sr">Record</span>
            </button>
          )}
        </div>
        {audio ? (
          <div className="mt-3">
            <MomentAudioPlayer bytes={audio.bytes} durationSeconds={audio.durationSeconds} src={audio.previewUrl} />
            <SpokenLine
              onChange={applySpokenEdit}
              onCommit={commitSpokenEdit}
              value={spoken || audio.transcript}
            />
            <p className="fam-muted mt-2">
              {audio.status === "uploaded" ? "已上傳" : audio.status === "failed" ? "還沒進倉" : "上傳中"}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className="fam-pill fam-pill-quiet min-h-11" onClick={() => void retakeAudio()} type="button">
                Retake audio
              </button>
              <button className="fam-pill fam-pill-quiet min-h-11" onClick={clearAudio} type="button">
                Remove audio
              </button>
            </div>
          </div>
        ) : audioHold ? (
          <div className="fam-card mt-3 p-4">
            <p className="fam-label">約 {audioHold.durationSeconds} 秒</p>
            <SpokenLine onChange={applySpokenEdit} onCommit={commitSpokenEdit} value={spoken} />
            <p className="fam-muted mt-2">準備播放…</p>
          </div>
        ) : recording && spoken ? (
          <SpokenLine onChange={applySpokenEdit} readOnly value={spoken} />
        ) : (
          <button className="fam-pill fam-pill-quiet mt-3 min-h-11 w-full" disabled type="button">
            Remove audio
          </button>
        )}

        <label className="fam-field mt-5 block">
          <span className="fam-label">心情或交代 / Mood or a job</span>
          <textarea
            onChange={(event) => setNote(event.target.value)}
            placeholder="一句心情，或交代一件事。不確定就當心情。"
            rows={3}
            value={note}
          />
        </label>

        <p aria-live="polite" className="fam-muted mt-3">
          {message}
        </p>

        {savedJobId ? (
          <Link className="fam-pill fam-pill-quiet mt-3 w-full" href={`/trips/write?job=${savedJobId}`}>
            Open job in Write
          </Link>
        ) : null}

        <Link
          className="fam-pill fam-pill-honey mt-4 w-full"
          href={
            savedMomentId ? `/family/bench?moment=${encodeURIComponent(savedMomentId)}` : "/family/bench"
          }
        >
          去工作台看看
        </Link>

        <button
          className="fam-pill fam-pill-quiet mt-3 w-full"
          disabled={!note.trim() && !spoken.trim()}
          onClick={() => void saveMoment()}
          type="button"
        >
          {saving ? "寫下中…" : "寫下一句"}
        </button>
      </section>
    </main>
  );
}
