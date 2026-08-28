"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MomentAudioPlayer } from "@/app/family/moment-audio-player";
import { startCaptureSpeech } from "@/lib/capture-speech";
import {
  CAPTURE_DUMP_LIMIT,
  captureDumpProgressMessage,
  captureErrorMessage,
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
  uploadDisplayPhoto,
  uploadMomentAudio,
  uploadOriginalPhotoInBackground,
} from "@/lib/capture-upload";
import { FAMILY_ADMIN_SESSION_KEY, resolveFamilySession } from "@/lib/family-session";
import { preferredRecorderMime } from "@/lib/moment-audio";
import { preparePlayableAudio, primePlaybackAudioContext } from "@/lib/moment-audio-playback";
import { appendMomentPhotos, classifyCaptureNote } from "@/lib/moments";
import type { GeoPoint, TravelJob } from "@/lib/types";

type UploadStatus = "queued" | "uploading" | "uploaded" | "failed";

type StagedPhoto = {
  abort: AbortController;
  errorMessage: string | null;
  file: File;
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

const controlClass =
  "relative flex min-h-12 cursor-pointer items-center justify-center rounded-2xl border px-4 py-3 text-center text-sm font-semibold shadow-sm";
const hiddenFileClass = "absolute inset-0 cursor-pointer opacity-0";

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
  const [pin, setPin] = useState("");
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
    return createMomentSession((time) =>
      createCaptureMoment({
        coordinates: coordinatesRef.current,
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
      const takenAt = new Date(photo.file.lastModified).toISOString();
      try {
        const momentId = await session.ensure(takenAt);
        if (photo.abort.signal.aborted) {
          return;
        }

        const uploaded = await uploadDisplayPhoto({
          coordinates: coordinatesRef.current,
          file: photo.file,
          momentId,
          onDisplayReady: async (display) => {
            if (photo.abort.signal.aborted) {
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
        if (photo.abort.signal.aborted || !photoIsOnScreen(photo.id)) {
          return;
        }
        const detail = captureErrorMessage(error, "Photo upload failed.");
        patchPhoto(photo.id, { errorMessage: detail, status: "failed" });
        setMessage(detail);
        throw error;
      }
    })();

    photoUploadsRef.current.set(photo.id, run.then(() => undefined, () => undefined));
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

        await uploadMomentAudio({
          blob: staged.blob,
          momentId,
          pin: sessionPin(pinRef.current),
          retryMoment: (status) => retryMoment(recordedAt, status),
          signal: staged.abort.signal,
          transcript: spokenRef.current || staged.transcript,
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
          const next = { ...current, errorMessage: null, status: "uploaded" as const };
          audioRef.current = next;
          return next;
        });
      } catch (error) {
        if (staged.abort.signal.aborted) {
          return;
        }
        const detail = captureErrorMessage(error, "Audio upload failed.");
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
      onCopied(file, progress) {
        const incoming = createStagedCapturePhotos([file]).map((draft) => ({
          ...draft,
          abort: new AbortController(),
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
      stopSpeechRef.current?.();
      stopSpeechRef.current = startCaptureSpeech((text) => {
        spokenRef.current = text;
        setSpoken(text);
      }).stop;
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

      await Promise.all([...photoUploadsRef.current.values()]);
      if (audioUploadRef.current) {
        await audioUploadRef.current;
      }

      const failedPhoto = photosRef.current.find((photo) => photo.status === "failed");
      if (failedPhoto) {
        throw new Error("有照片還沒傳上去，請再試一次。");
      }
      if (audioRef.current?.status === "failed") {
        throw new Error("聲音還沒傳上去，請再試一次。");
      }

      let createdJob: TravelJob | null = null;
      let keptMomentId = momentSession().momentId;
      if (keptMomentId) {
        const saved = await finalizeCaptureMoment({
          command: classified.command,
          coordinates: coordinatesRef.current,
          momentId: keptMomentId,
          note: classified.note,
          pin: sessionPin(pinRef.current),
          time,
          transcript: audioRef.current?.transcript || spokenRef.current || null,
        });
        createdJob = saved.job;
        keptMomentId = saved.moment?.id ?? keptMomentId;
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
      setSavedJobId(createdJob?.id ?? null);
      setSavedMomentId(keptMomentId);
      resetDraft();
      setMessage(
        createdJob
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
      <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
        <section className="mx-auto max-w-md px-6 py-8 lg:px-10">
          <div className="rounded-3xl border border-emerald-200 bg-white p-6 text-center shadow-sm">
            <p className="travel-label text-sm font-semibold text-emerald-900">
              {redirecting ? "正在返回家庭登入…" : "正在開啟 Capture…"}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {redirecting ? "Capture 使用同一個家庭密碼，不會另外開密碼表單。" : "家庭入口開啟中，不必先輸入密碼。"}
            </p>
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
          <p className="travel-script mt-8 text-2xl text-rose-700">one capture door</p>
          <h1 className="travel-display mt-2 text-4xl font-semibold">Capture</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            打開就能拍或錄。先看剛留下的，不好就重拍或重錄，缺的再補一張。一次選很多張會立刻開始上傳，這一輪最多 40 張，其餘再選一次。再選一次相簿會清掉畫面上的上一輪，上一輪已在倉庫裡。存成 Moment，不是新的旅程。一句話可以是心情，也可以是交代給 TravelOS 的工作。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-6 py-8 lg:px-10">
        <article className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">拍照與相簿都留著</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">Take Photo / Choose Photos</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">加入之後兩個按鈕都還在。拍照會接在這一輪後面。再選一次相簿會清掉畫面上的上一輪，上一輪已在倉庫裡。一次最多先傳 40 張，會立刻開始上傳。其餘請再選一次。</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className={`${controlClass} border-sky-300 bg-sky-50 text-sky-950`}>
              拍照 / Take Photo
              <input
                accept="image/*"
                capture="environment"
                className={hiddenFileClass}
                onChange={onTakePhoto}
                ref={cameraInputRef}
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
            <ul className="mt-5 grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <li className="overflow-hidden rounded-2xl bg-stone-100" key={photo.id}>
                  {photo.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-40 w-full object-cover" src={photo.previewUrl} />
                  ) : (
                    <div className="flex h-40 items-center justify-center bg-stone-200 px-3 text-center">
                      <p className="line-clamp-3 text-xs font-medium text-zinc-600">{photo.file.name}</p>
                    </div>
                  )}
                  <p className="px-2 pt-2 text-center text-xs font-semibold text-zinc-600">
                    {photo.status === "uploaded"
                      ? "已上傳"
                      : photo.status === "failed"
                        ? "上傳失敗"
                        : photo.status === "queued"
                          ? "排隊中"
                          : "上傳中"}
                  </p>
                  {photo.errorMessage ? (
                    <p className="px-2 pb-1 text-center text-[11px] leading-4 text-rose-800">{photo.errorMessage}</p>
                  ) : null}
                  <div className="grid grid-cols-2 gap-1 p-2">
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white text-xs font-semibold text-zinc-800"
                      onClick={() => retakePhoto(photo.id)}
                      type="button"
                    >
                      Retake
                    </button>
                    <button
                      className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white text-xs font-semibold text-zinc-800"
                      onClick={() => removePhoto(photo.id)}
                      type="button"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-6 text-center text-sm text-zinc-600">
              還沒有照片。先拍照或從相簿選。一次選很多張也可以，會分批上傳。
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="travel-label text-sm font-semibold text-zinc-700">聲音 / Audio</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {recording ? (
                <button
                  className="min-h-12 rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 font-semibold text-rose-950"
                  onClick={stopRecording}
                  type="button"
                >
                  Stop
                </button>
              ) : (
                <button
                  className="min-h-12 rounded-2xl border border-emerald-300 bg-white px-4 py-3 font-semibold text-emerald-950"
                  onClick={() => void startRecording()}
                  type="button"
                >
                  Record
                </button>
              )}
              {audio ? (
                <button
                  className="min-h-12 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-950"
                  onClick={() => void retakeAudio()}
                  type="button"
                >
                  Retake audio
                </button>
              ) : (
                <button
                  className="min-h-12 rounded-2xl border border-stone-200 bg-white px-4 py-3 font-semibold text-zinc-500"
                  disabled
                  type="button"
                >
                  Remove audio
                </button>
              )}
            </div>
            {audio ? (
              <div className="mt-3 grid gap-2">
                <MomentAudioPlayer bytes={audio.bytes} durationSeconds={audio.durationSeconds} src={audio.previewUrl} />
                {spoken || audio.transcript ? (
                  <p className="text-base leading-7 text-zinc-800">{spoken || audio.transcript}</p>
                ) : null}
                <p className="text-xs font-semibold text-zinc-600">
                  {audio.status === "uploaded" ? "已上傳" : audio.status === "failed" ? "上傳失敗" : "上傳中"}
                </p>
                {audio.errorMessage ? <p className="text-[11px] leading-4 text-rose-800">{audio.errorMessage}</p> : null}
                <button
                  className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-zinc-800"
                  onClick={clearAudio}
                  type="button"
                >
                  Remove audio
                </button>
              </div>
            ) : audioHold ? (
              <div className="mt-3 rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-zinc-800">約 {audioHold.durationSeconds} 秒</p>
                {spoken ? <p className="mt-2 text-base leading-7 text-zinc-800">{spoken}</p> : null}
                <p className="mt-2 text-sm leading-6 text-stone-500">準備播放…</p>
              </div>
            ) : recording && spoken ? (
              <p className="mt-3 text-base leading-7 text-zinc-800">{spoken}</p>
            ) : null}
          </div>

          <label className="mt-6 block">
            <span className="travel-label text-sm font-semibold text-zinc-700">心情或交代 / Mood or a job</span>
            <textarea
              className="mt-2 min-h-20 w-full rounded-2xl border border-emerald-300 bg-white px-4 py-3 text-base text-zinc-950 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              onChange={(event) => setNote(event.target.value)}
              placeholder="一句心情，或交代一件事。不確定就當心情。"
              rows={3}
              value={note}
            />
          </label>

          <p aria-live="polite" className="mt-3 text-sm leading-6 text-zinc-600">
            {message}
          </p>

          {savedJobId ? (
            <Link
              className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 font-semibold text-sky-950"
              href={`/trips/write?job=${savedJobId}`}
            >
              Open job in Write
            </Link>
          ) : null}

          {savedMomentId ? (
            <Link
              className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-950"
              href={`/family/bench?moment=${encodeURIComponent(savedMomentId)}`}
            >
              去工作台看看
            </Link>
          ) : null}

          <button
            className="mt-5 min-h-12 w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-950 disabled:opacity-60"
            disabled={!hasCapture}
            onClick={() => void saveMoment()}
            type="button"
          >
            {saving ? "儲存中…" : "Save as Moment"}
          </button>
        </article>
      </section>
    </main>
  );
}
