"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FAMILY_ADMIN_SESSION_KEY } from "@/lib/family-session";
import { appendMomentPhotos, classifyCaptureNote, isHeicPhoto } from "@/lib/moments";
import { maxUploadBytes, preparePhotoForUpload } from "@/lib/prepare-photo";
import type { GeoPoint, TravelJob, TravelMoment } from "@/lib/types";

type StagedPhoto = {
  file: File;
  id: string;
  previewUrl: string;
};

type StagedAudio = {
  blob: Blob;
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

function pinHeaders(pin: string) {
  return { "x-travelos-admin-pin": pin };
}

export default function CapturePage() {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<StagedPhoto[]>([]);
  const audioRef = useRef<StagedAudio | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [photos, setPhotos] = useState<StagedPhoto[]>([]);
  const [note, setNote] = useState("");
  const [audio, setAudio] = useState<StagedAudio | null>(null);
  const [recording, setRecording] = useState(false);
  const [coordinates, setCoordinates] = useState<GeoPoint | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedJobId, setSavedJobId] = useState<string | null>(null);
  const [message, setMessage] = useState("拍一張、選一張，或錄一小段。先看剛留下的，不好就重拍。");

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
    if (!authenticated || !("geolocation" in navigator)) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoordinates({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
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
        URL.revokeObjectURL(photo.previewUrl);
      }
      if (audioRef.current) {
        URL.revokeObjectURL(audioRef.current.previewUrl);
      }
      recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function addIncomingFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const incoming = makeStagedPhotos([...fileList]);
    if (incoming.length === 0) {
      setMessage("請選照片。iPhone HEIC 會在儲存時轉成 JPEG，或直接收下原檔。");
      return;
    }

    setPhotos((current) => {
      const next = appendMomentPhotos(current, incoming);
      setMessage(`已加入 ${next.length} 張。可再拍、再選，或重拍不好的那張。`);
      return next;
    });
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

  function retakePhoto(photoId: string) {
    removePhoto(photoId);
    cameraInputRef.current?.click();
  }

  function clearAudio() {
    if (audio) {
      URL.revokeObjectURL(audio.previewUrl);
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
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const previewUrl = URL.createObjectURL(blob);
        if (audioRef.current) {
          URL.revokeObjectURL(audioRef.current.previewUrl);
        }
        setAudio({ blob, previewUrl });
        setRecording(false);
        setMessage("聽一下剛錄的。若是雜音就重錄。");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setMessage("正在錄音…");
    } catch {
      setMessage("沒有麥克風權限，照片與心情仍可儲存。");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function retakeAudio() {
    clearAudio();
    void startRecording();
  }

  async function saveMoment() {
    if (!note.trim() && photos.length === 0 && !audio) {
      setMessage("先拍一張、選一張、錄一段，或寫下一句心情。");
      return;
    }

    setSaving(true);
    setMessage("正在存成 Moment…");

    try {
      const sessionPin = window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? pin;
      const classified = classifyCaptureNote(note);
      const time = photos[0]?.file.lastModified
        ? new Date(photos[0].file.lastModified).toISOString()
        : new Date().toISOString();

      const createResponse = await fetch("/api/moments", {
        body: JSON.stringify({
          command: classified.command,
          coordinates,
          note: classified.note,
          time,
        }),
        headers: {
          "content-type": "application/json",
          ...pinHeaders(sessionPin),
        },
        method: "POST",
      });

      if (!createResponse.ok) {
        const data = (await createResponse.json()) as { error?: string };
        throw new Error(data.error ?? "Could not save this moment.");
      }

      const created = (await createResponse.json()) as { job: TravelJob | null; moment: TravelMoment };
      const momentId = created.moment.id;

      if (audio) {
        const audioData = new FormData();
        audioData.set("momentId", momentId);
        audioData.set("file", new File([audio.blob], "moment-audio.webm", { type: audio.blob.type || "audio/webm" }));
        const audioResponse = await fetch("/api/moments/audio", {
          body: audioData,
          headers: pinHeaders(sessionPin),
          method: "POST",
        });
        if (!audioResponse.ok) {
          const data = (await audioResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Audio upload failed.");
        }
      }

      for (const [index, staged] of photos.entries()) {
        setMessage(`正在存第 ${index + 1} / ${photos.length} 張…`);
        const prepared = await preparePhotoForUpload(staged.file);
        if (prepared.display.size > maxUploadBytes) {
          throw new Error("Photo is still too large after compression. Please choose a smaller photo.");
        }

        const formData = new FormData();
        formData.set("file", prepared.display);
        formData.set("momentId", momentId);
        formData.set("takenAt", new Date(staged.file.lastModified).toISOString());
        if (prepared.original !== prepared.display && prepared.original.size <= maxUploadBytes) {
          formData.set("original", prepared.original);
        }
        if (coordinates) {
          formData.set("latitude", String(coordinates.latitude));
          formData.set("longitude", String(coordinates.longitude));
        }

        const photoResponse = await fetch("/api/moments/photos", {
          body: formData,
          headers: pinHeaders(sessionPin),
          method: "POST",
        });
        if (!photoResponse.ok) {
          const data = (await photoResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Photo upload failed.");
        }
      }

      for (const photo of photos) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      if (audio) {
        URL.revokeObjectURL(audio.previewUrl);
      }
      setPhotos([]);
      setAudio(null);
      setNote("");
      setSavedJobId(created.job?.id ?? null);
      setMessage(
        created.job
          ? "已存成工作。照片在倉庫裡，打開 Write 看那些照片自己寫。"
          : "已存成 Moment。可再拍一張補上。",
      );
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
            <p className="mt-3 text-sm leading-6 text-zinc-600">Capture 使用同一個家庭密碼，不會另外開密碼表單。</p>
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
          <p className="travel-script mt-8 text-2xl text-rose-700">JDB Capture</p>
          <h1 className="travel-display mt-2 text-4xl font-semibold">Capture</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">
            打開就能拍或錄。先看剛留下的，不好就重拍或重錄，缺的再補一張。存成 Moment，不是新的旅程。一句話可以是心情，也可以是交代給 TravelOS 的工作。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-6 py-8 lg:px-10">
        <article className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">拍照與相簿都留著</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">Take Photo / Choose Photos</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">加入之後兩個按鈕都還在。新的會接在後面，不會蓋掉剛拍的。</p>

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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="h-40 w-full object-cover" src={photo.previewUrl} />
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
              還沒有照片。先拍照或從相簿選，選完立刻看得到。
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
                <audio className="w-full" controls src={audio.previewUrl} />
                <button
                  className="min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-zinc-800"
                  onClick={clearAudio}
                  type="button"
                >
                  Remove audio
                </button>
              </div>
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

          <button
            className="mt-5 min-h-12 w-full rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-950 disabled:opacity-60"
            disabled={saving}
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
