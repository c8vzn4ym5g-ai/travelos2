"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  CAPTURE_MOMENT_FETCH_TIMEOUT_MS,
  CAPTURE_PHOTO_FETCH_TIMEOUT_MS,
  CAPTURE_AUDIO_FETCH_TIMEOUT_MS,
  CAPTURE_SAVE_FAILED_MESSAGE,
  CAPTURE_UPLOAD_FAILED_MESSAGE,
  awaitCaptureSave,
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
  finalizeCaptureMoment,
  ingestCaptureFileList,
  removeUploadedPhotoInBackground,
  shouldReplaceCaptureDumpRound,
  updateMomentTranscript,
  uploadDisplayPhoto,
  uploadMomentAudio,
  uploadOriginalPhotoInBackground,
} from "@/lib/capture-upload";
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
  serverPhotoId: string | null;
  status: UploadStatus;
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

function photoChip(photo: Pick<StagedPhoto, "hopDone" | "hopTotal" | "status">) {
  if (photo.status === "uploaded") {
    return { className: "fam-chip fam-chip-mint", label: "已上傳" };
  }
  if (photo.status === "failed") {
    return { className: "fam-chip fam-chip-blush", label: "上傳失敗" };
  }
  if (photo.status === "queued") {
    return { className: "fam-chip fam-chip-sky", label: "排隊中" };
  }
  if (photo.hopTotal > 0 && photo.hopDone > 0) {
    return { className: "fam-chip fam-chip-honey", label: `上傳中 ${photo.hopDone}/${photo.hopTotal}` };
  }
  return { className: "fam-chip fam-chip-honey", label: "上傳中" };
}

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
  const audioUploadRef = useRef<Promise<void> | null>(null);
  const savingRef = useRef(false);
  const persistTimerRef = useRef<number>(0);
  const speechLangRef = useRef<CaptureSpeechLangId>("cmn");
  const [pin, setPin] = useState("");
  const [speechLang, setSpeechLang] = useState<CaptureSpeechLangId>("cmn");
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [note, setNote] = useState("");
  const [audio, setAudio] = useState<StagedAudio | null>(null);
  const [audioHold, setAudioHold] = useState<{ durationSeconds: number } | null>(null);
  const [spoken, setSpoken] = useState("");
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [savedMomentId, setSavedMomentId] = useState<string | null>(null);
  const [message, setMessage] = useState("拍一張、選一張，或錄一小段。先看剛留下的，不好就重拍。");

  const hasCapture = note.trim().length > 0 || photos.length > 0 || Boolean(audio);

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
  }

  function beginFreshDumpRound() {
    photosRef.current = detachStagedCapturePhotos(photosRef.current);
    setPhotos(() => photosRef.current);
    photoUploadsRef.current = new Map();
    momentSessionRef.current = createLiveMomentSession();
  }

  async function ensureMoment(time: string) {
    return momentSession().ensure(time);
  }

  async function retryMoment(
    time: string,
    status: number,
    session = momentSession(),
  ) {
    if (status === 404 && !session.momentId) {
      session.reset();
    }
    return session.ensure(time);
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
        // Save as Moment still writes the latest spoken line.
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
    const session = momentSession();
    const run = (async () => {
      if (photo.abort.signal.aborted) {
        return;
      }

      patchPhoto(photo.id, { status: "uploading" });
      let watchdogFired = false;
      const watchdogMs = isCaptureVideoFile(photo.file)
        ? captureUploadWatchdogMs(photo.file.size)
        : CAPTURE_MOMENT_FETCH_TIMEOUT_MS + CAPTURE_PHOTO_FETCH_TIMEOUT_MS;
      const watchdog = globalThis.setTimeout(() => {
        watchdogFired = true;
        if (photoIsOnScreen(photo.id)) {
          patchPhoto(photo.id, { errorMessage: CAPTURE_UPLOAD_FAILED_MESSAGE, status: "failed" });
          setMessage(CAPTURE_UPLOAD_FAILED_MESSAGE);
        }
        if (!photo.abort.signal.aborted) {
          photo.abort.abort();
        }
      }, watchdogMs);
      try {
        const takenAt = Number.isFinite(photo.file.lastModified)
          ? new Date(photo.file.lastModified).toISOString()
          : new Date().toISOString();
        const momentId = session.allocate(takenAt);
        const video = isCaptureVideoFile(photo.file);
        if (!video) {
          await session.ensure(takenAt);
        }
        if (photo.abort.signal.aborted) {
          return;
        }

        const uploaded = await uploadDisplayPhoto({
          coordinates: coordinatesRef.current,
          file: photo.file,
          momentId,
          onHopProgress: (hopDone, hopTotal) => {
            if (photoIsOnScreen(photo.id)) {
              patchPhoto(photo.id, { hopDone, hopTotal, status: "uploading" });
            }
          },
          startMoment: video ? () => session.ensure(takenAt) : undefined,
          onDisplayReady: async (display) => {
            if (photo.abort.signal.aborted || isCaptureVideoFile(photo.file)) {
              return;
            }
            const previewUrl = await createTinyPreviewUrl(display);
            if (!previewUrl) {
              return;
            }
            if (photo.abort.signal.aborted || !photoIsOnScreen(photo.id)) {
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

        if (photo.abort.signal.aborted) {
          removeUploadedPhotoInBackground({
            momentId: uploaded.momentId,
            photoId: uploaded.photo.id,
            pin: sessionPin(pinRef.current),
          });
          return;
        }

        patchPhoto(photo.id, { errorMessage: null, serverPhotoId: uploaded.photo.id, status: "uploaded" });
        uploadOriginalPhotoInBackground({
          display: uploaded.display,
          momentId: uploaded.momentId,
          original: photo.file,
          photoId: uploaded.photo.id,
          pin: sessionPin(pinRef.current),
        });
      } catch (error) {
        if (!photoIsOnScreen(photo.id)) {
          return;
        }
        if (photo.abort.signal.aborted && !watchdogFired) {
          return;
        }
        const current = photosRef.current.find((item) => item.id === photo.id);
        if (current?.status === "failed") {
          return;
        }
        const detail = captureErrorMessage(error, CAPTURE_UPLOAD_FAILED_MESSAGE);
        patchPhoto(photo.id, { errorMessage: detail, status: "failed" });
        setMessage(detail);
        throw error;
      } finally {
        globalThis.clearTimeout(watchdog);
      }
    })();

    photoUploadsRef.current.set(photo.id, run.then(() => undefined, () => undefined));
    return run;
  }

  async function startBackgroundAudioUpload(staged: StagedAudio) {
    const run = (async () => {
      const recordedAt = new Date().toISOString();
      let watchdogFired = false;
      const watchdog = globalThis.setTimeout(() => {
        watchdogFired = true;
        if (audioRef.current?.previewUrl === staged.previewUrl) {
          const detail = CAPTURE_UPLOAD_FAILED_MESSAGE;
          setAudio((current) => {
            if (current?.previewUrl !== staged.previewUrl) {
              return current;
            }
            const next = { ...current, errorMessage: detail, status: "failed" as const };
            audioRef.current = next;
            return next;
          });
          setMessage(detail);
        }
        if (!staged.abort.signal.aborted) {
          staged.abort.abort();
        }
      }, CAPTURE_AUDIO_FETCH_TIMEOUT_MS + CAPTURE_MOMENT_FETCH_TIMEOUT_MS);
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
        if (staged.abort.signal.aborted && !watchdogFired) {
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
        setMessage(detail);
        throw error;
      } finally {
        globalThis.clearTimeout(watchdog);
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

    setMessage(
      captureDumpProgressMessage(
        fileListLength,
        photosRef.current.length + Math.min(fileListLength, CAPTURE_DUMP_LIMIT),
        { freshRound },
      ),
    );

    await ingestCaptureFileList(fileList, {
      limit: CAPTURE_DUMP_LIMIT,
      async onCopied(file, progress) {
        const incoming = createStagedCapturePhotos([file]).map((draft) => ({
          ...draft,
          abort: new AbortController(),
          hopDone: 0,
          hopTotal: isCaptureVideoFile(file) ? captureVideoHopCount(file.size) : 0,
          previewUrl: isCaptureVideoFile(file) ? captureVideoPreviewUrl(file) : null,
        }));
        if (incoming.length === 0) {
          return;
        }

        setPhotos((current) => {
          const next = appendMomentPhotos(current, incoming);
          photosRef.current = next;
          setMessage(captureDumpProgressMessage(progress.fileListLength, next.length, { freshRound }));
          return next;
        });

        for (const photo of incoming) {
          void startBackgroundPhotoUpload(photo);
        }
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
    if (input && input.files === fileList) {
      input.value = "";
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
      return current.filter((photo) => photo.id !== photoId);
    });
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
    if (!note.trim() && photos.length === 0 && !audio) {
      setMessage("先拍一張、選一張、錄一段，或寫下一句心情。");
      return;
    }

    if (savingRef.current) {
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setMessage("正在存成 Moment…");

    try {
      const classified = classifyCaptureNote(note);
      const time = photos[0]?.file.lastModified
        ? new Date(photos[0].file.lastModified).toISOString()
        : new Date().toISOString();

      const saved = await awaitCaptureSave(
        (async () => {
          await Promise.all([...photoUploadsRef.current.values()]);
          if (audioUploadRef.current) {
            await audioUploadRef.current;
          }

          const unfinishedPhoto = photosRef.current.find((photo) => photo.status !== "uploaded");
          if (unfinishedPhoto) {
            throw new Error(
              unfinishedPhoto.status === "failed"
                ? "有照片或影片還沒傳上去，請再試一次。"
                : CAPTURE_SAVE_FAILED_MESSAGE,
            );
          }
          if (audioRef.current && audioRef.current.status !== "uploaded") {
            throw new Error(
              audioRef.current.status === "failed" ? "聲音還沒傳上去，請再試一次。" : CAPTURE_SAVE_FAILED_MESSAGE,
            );
          }

          let createdJob: TravelJob | null = null;
          let keptMomentId = momentSession().momentId;
          if (keptMomentId) {
            const finalized = await finalizeCaptureMoment({
              command: classified.command,
              coordinates: coordinatesRef.current,
              momentId: keptMomentId,
              note: classified.note,
              pin: sessionPin(pinRef.current),
              time,
              transcript: spokenRef.current || audioRef.current?.transcript || null,
            });
            createdJob = finalized.job;
            keptMomentId = finalized.moment?.id ?? keptMomentId;
          } else {
            const created = await createCaptureMoment({
              command: classified.command,
              coordinates: coordinatesRef.current,
              note: classified.note,
              pin: sessionPin(pinRef.current),
              time,
            });
            createdJob = created.job;
            keptMomentId = created.moment.id;
          }

          return { createdJob, keptMomentId };
        })(),
      );

      for (const photo of photosRef.current) {
        if (photo.previewUrl) {
          URL.revokeObjectURL(photo.previewUrl);
        }
      }
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.previewUrl);
      }
      setPhotos([]);
      setAudio(null);
      setNote("");
      spokenRef.current = "";
      setSpoken("");
      setSavedJobId(saved.createdJob?.id ?? null);
      setSavedMomentId(saved.keptMomentId);
      resetDraft();
      setMessage(
        saved.createdJob
          ? "已存成工作。照片在倉庫裡，打開 Write 看那些照片自己寫。"
          : "已存成 Moment。可再拍一張補上。",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "儲存失敗，請再試一次。");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  if (!authenticated) {
    return (
      <main className="fam-page">
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
    <main className="fam-page">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <FamilyBackLink className="min-h-11" href="/family">
            ← 家庭入口
          </FamilyBackLink>
          <p className="fam-script">one capture door</p>
          <h1 className="fam-title">Capture</h1>
          <p className="fam-lede">
            打開就能拍或錄。先看剛留下的，不好就重拍或重錄，缺的再補一張。一次選很多張會立刻開始上傳，這一輪最多 40 張，其餘再選一次。再選一次相簿會清掉畫面上的上一輪，上一輪已在倉庫裡。存成 Moment，不是新的旅程。一句話可以是心情，也可以是交代給 TravelOS 的工作。
          </p>
        </div>
      </header>

      <section className="fam-sheet">
        <div className="grid grid-cols-2 gap-3">
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
        <p className="fam-muted mt-3">加入之後兩個按鈕都還在。拍照會接在這一輪後面。再選一次相簿會清掉畫面上的上一輪，上一輪已在倉庫裡。</p>

        {photos.length > 0 ? (
          <>
            <ul className="mt-5 grid grid-cols-2 gap-3">
              {photos.map((photo) => {
                const chip = photoChip(photo);
                return (
                  <li className="fam-thumb" key={photo.id}>
                    {isCaptureVideoFile(photo.file) ? (
                      <CaptureVideoThumb file={photo.file} previewUrl={photo.previewUrl} />
                    ) : photo.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={photo.previewUrl} />
                    ) : (
                      <div className="fam-thumb-fallback">
                        {isCaptureVideoFile(photo.file) ? <FamGlyph name="play" /> : null}
                        <p className="line-clamp-3">{photo.file.name}</p>
                      </div>
                    )}
                    <span className={chip.className}>{chip.label}</span>
                    {photo.status === "queued" ? <span className="fam-sr">接著會傳</span> : null}
                    {photo.errorMessage ? <p className="fam-ref">{photo.errorMessage}</p> : null}
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
              {audio.status === "uploaded" ? "已上傳" : audio.status === "failed" ? "上傳失敗" : "上傳中"}
            </p>
            {audio.errorMessage ? <p className="fam-ref">{audio.errorMessage}</p> : null}
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
          disabled={!hasCapture}
          onClick={() => void saveMoment()}
          type="button"
        >
          {saving ? "儲存中…" : "Save as Moment"}
        </button>
      </section>
    </main>
  );
}
