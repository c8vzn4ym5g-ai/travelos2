"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { TravelOSContent } from "@/lib/editable-store";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders, resolveFamilySession } from "@/lib/family-session";
import {
  filterMomentsByDayAndPlace,
  findFoundSetJob,
  foundSetCommand,
  hasWarehouseFoundSet,
  momentCalendarDay,
  momentPlaceLabels,
  photosFromMoments,
  warehouseDays,
  warehousePlaces,
} from "@/lib/moment-index";
import type { MomentContent } from "@/lib/moment-store";
import { createTravelJob, momentPhotoPlayUrl } from "@/lib/moments";
import type { JournalEntry, TravelJob, TravelMoment, TripDetail } from "@/lib/types";

type MomentsResponse = {
  content: MomentContent;
  status: {
    configured: boolean;
    source: "blob" | "memory";
  };
};

type TripsResponse = {
  content: TravelOSContent;
};

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function pinHeaders(pin: string) {
  return familyPinHeaders(pin);
}

export default function SitAndWritePage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [moments, setMoments] = useState<TravelMoment[]>([]);
  const [jobs, setJobs] = useState<TravelJob[]>([]);
  const [trips, setTrips] = useState<TripDetail[]>([]);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [hiddenPhotoIds, setHiddenPhotoIds] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [attachTripId, setAttachTripId] = useState("");
  const [dayFilter, setDayFilter] = useState("");
  const [placeFilter, setPlaceFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("選一個 Moment 或工作，看著照片慢慢寫。這裡不會代寫。");

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

  const load = useCallback(async () => {
    const sessionPin = window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? pin;
    const [momentsResponse, tripsResponse] = await Promise.all([
      fetch("/api/moments", { cache: "no-store", headers: pinHeaders(sessionPin) }),
      fetch("/api/trips/content", { cache: "no-store", headers: pinHeaders(sessionPin) }),
    ]);

    if (!momentsResponse.ok) {
      throw new Error("Could not load moments.");
    }

    const momentData = (await momentsResponse.json()) as MomentsResponse;
    const requestedJobId = new URLSearchParams(window.location.search).get("job");
    setMoments(momentData.content.moments);
    setJobs(momentData.content.jobs ?? []);

    if (tripsResponse.ok) {
      const tripData = (await tripsResponse.json()) as TripsResponse;
      setTrips(tripData.content.trips);
    }

    setActiveJobId((current) => current ?? requestedJobId);
    setActiveMomentId((current) => current ?? momentData.content.moments[0]?.id ?? null);
    setMessage(
      momentData.content.moments.length > 0
        ? "照片在旁邊。空白處只放你自己寫的字。工作文字不會當成日記。"
        : "倉庫裡還沒有 Moment。先去 Capture 拍一張。",
    );
  }, [pin]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    load().catch(() => setMessage("Could not load TravelOS moments."));
  }, [authenticated, load]);

  const activeJob = useMemo(
    () => jobs.find((job) => job.id === activeJobId) ?? null,
    [activeJobId, jobs],
  );
  const jobMoments = useMemo(() => {
    if (!activeJob) {
      return [];
    }

    const byId = new Map(moments.map((moment) => [moment.id, moment]));
    return activeJob.momentIds.map((id) => byId.get(id)).filter((moment): moment is TravelMoment => Boolean(moment));
  }, [activeJob, moments]);
  const activeMoment = useMemo(
    () => moments.find((moment) => moment.id === activeMomentId) ?? moments[0] ?? null,
    [activeMomentId, moments],
  );
  const availableDays = useMemo(() => warehouseDays(moments), [moments]);
  const availablePlaces = useMemo(() => warehousePlaces(moments), [moments]);
  const visibleWarehouseMoments = useMemo(
    () => filterMomentsByDayAndPlace(moments, { day: dayFilter, place: placeFilter }),
    [dayFilter, moments, placeFilter],
  );
  const foundSetKey = `${dayFilter}\0${placeFilter}`;
  const usingFoundSet = !activeJob && hasWarehouseFoundSet({ day: dayFilter, place: placeFilter });
  const foundSetJob = useMemo(
    () => findFoundSetJob(jobs, { day: dayFilter, place: placeFilter }),
    [dayFilter, jobs, placeFilter],
  );
  const writingMoments = activeJob ? jobMoments : usingFoundSet ? visibleWarehouseMoments : activeMoment ? [activeMoment] : [];
  const writingPhotos = photosFromMoments(writingMoments);

  useEffect(() => {
    if (activeJob) {
      setDraft(activeJob.draft);
      setHiddenPhotoIds([]);
      setAttachTripId("");
    }
  }, [activeJob]);

  useEffect(() => {
    if (activeJob || !usingFoundSet) {
      return;
    }

    setDraft(foundSetJob?.draft ?? "");
    setHiddenPhotoIds([]);
    setAttachTripId("");
  }, [activeJob, foundSetJob, foundSetKey, usingFoundSet]);

  useEffect(() => {
    if (activeJob || usingFoundSet) {
      return;
    }

    if (!activeMoment) {
      setDraft("");
      setHiddenPhotoIds([]);
      return;
    }

    setDraft(activeMoment.draft);
    setHiddenPhotoIds([]);
    setAttachTripId(activeMoment.tripId ?? "");
  }, [activeJob, activeMoment, usingFoundSet]);

  const visiblePhotos = writingPhotos.filter((photo) => !hiddenPhotoIds.includes(photo.id));

  function changeDayFilter(day: string) {
    setDayFilter(day);
  }

  function changePlaceFilter(place: string) {
    setPlaceFilter(place);
  }

  function togglePhoto(photoId: string) {
    setHiddenPhotoIds((current) =>
      current.includes(photoId) ? current.filter((id) => id !== photoId) : [...current, photoId],
    );
  }

  function openJob(jobId: string) {
    setActiveJobId(jobId);
    const job = jobs.find((item) => item.id === jobId);
    if (job) {
      setActiveMomentId(job.sourceMomentId);
    }
  }

  function openMoment(momentId: string) {
    setActiveJobId(null);
    setActiveMomentId(momentId);
  }

  async function saveWriting() {
    if (!activeJob && usingFoundSet && visibleWarehouseMoments.length === 0) {
      setMessage("這個日子或地點沒有 Moment。");
      return;
    }

    if (!activeJob && !usingFoundSet && !activeMoment) {
      setMessage("沒有 Moment 可寫。");
      return;
    }

    setSaving(true);
    setMessage("正在保存你寫的字…");

    try {
      const sessionPin = window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? pin;

      if (activeJob) {
        const nextJob: TravelJob = {
          ...activeJob,
          draft,
        };
        const jobResponse = await fetch("/api/moments", {
          body: JSON.stringify({ job: nextJob }),
          headers: {
            "content-type": "application/json",
            ...pinHeaders(sessionPin),
          },
          method: "PUT",
        });
        if (!jobResponse.ok) {
          const data = (await jobResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Could not save this writing.");
        }
        const savedJob = (await jobResponse.json()) as { content: MomentContent; job: TravelJob };
        setJobs(savedJob.content.jobs);
        setMoments(savedJob.content.moments);
      } else if (usingFoundSet) {
        const sourceMoment = visibleWarehouseMoments[0];
        if (!sourceMoment) {
          throw new Error("這個日子或地點沒有 Moment。");
        }

        const momentIds = visibleWarehouseMoments.map((moment) => moment.id);
        const nextJob: TravelJob = foundSetJob
          ? {
              ...foundSetJob,
              draft,
              momentIds,
              sourceMomentId: sourceMoment.id,
            }
          : createTravelJob({
              command: foundSetCommand({ day: dayFilter, place: placeFilter }),
              draft,
              momentIds,
              sourceMomentId: sourceMoment.id,
            });
        const jobResponse = await fetch("/api/moments", {
          body: JSON.stringify({ job: nextJob }),
          headers: {
            "content-type": "application/json",
            ...pinHeaders(sessionPin),
          },
          method: "PUT",
        });
        if (!jobResponse.ok) {
          const data = (await jobResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Could not save this writing.");
        }
        const savedJob = (await jobResponse.json()) as { content: MomentContent; job: TravelJob };
        setJobs(savedJob.content.jobs);
        setMoments(savedJob.content.moments);
      } else if (activeMoment) {
        const nextMoment: TravelMoment = {
          ...activeMoment,
          draft,
          tripId: attachTripId || null,
        };

        const momentResponse = await fetch("/api/moments", {
          body: JSON.stringify({ moment: nextMoment }),
          headers: {
            "content-type": "application/json",
            ...pinHeaders(sessionPin),
          },
          method: "PUT",
        });

        if (!momentResponse.ok) {
          const data = (await momentResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Could not save this writing.");
        }

        const savedMoment = (await momentResponse.json()) as { content: MomentContent; moment: TravelMoment };
        setMoments(savedMoment.content.moments);
        setJobs(savedMoment.content.jobs ?? jobs);
      }

      if (attachTripId) {
        const trip = trips.find((item) => item.id === attachTripId);
        if (!trip) {
          throw new Error("That trip is not in TravelOS.");
        }

        const timestamp = nowIso();
        const entry: JournalEntry = {
          aiSummary: null,
          body: draft,
          createdAt: timestamp,
          entryDate: timestamp.slice(0, 10),
          id: makeId("journal"),
          mood: usingFoundSet || activeJob ? null : activeMoment?.note || null,
          storyPhotoId: null,
          title: timestamp.slice(0, 10),
          tripId: trip.id,
          updatedAt: timestamp,
          weatherSummary: null,
        };

        const updatedTrip: TripDetail = {
          ...trip,
          journalEntries: [entry, ...trip.journalEntries],
          updatedAt: timestamp,
        };

        const tripResponse = await fetch("/api/trips/content", {
          body: JSON.stringify({ trip: updatedTrip }),
          headers: {
            "content-type": "application/json",
            ...pinHeaders(sessionPin),
          },
          method: "PUT",
        });

        if (!tripResponse.ok) {
          const data = (await tripResponse.json()) as { error?: string };
          throw new Error(data.error ?? "Trip journal save failed.");
        }

        const tripData = (await tripResponse.json()) as { content: TravelOSContent };
        setTrips(tripData.content.trips);
      }

      setMessage(attachTripId ? "已保存你寫的字，並寫進選中的旅程。" : "已保存你寫的字。");
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
          <div className="rounded-3xl border border-sky-200 bg-white p-6 text-center shadow-sm">
            <p className="travel-label text-sm font-semibold text-sky-900">
              {redirecting ? "正在返回家庭登入…" : "正在開啟 Write…"}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {redirecting ? "寫作頁使用同一個家庭密碼，不會另外開密碼表單。" : "家庭入口開啟中，不必先輸入密碼。"}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const hasWritingTarget = writingMoments.length > 0;

  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
      <section className="border-b border-sky-100 bg-[linear-gradient(135deg,_#eff6ff_0%,_#fff7ed_100%)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="travel-label inline-flex min-h-11 items-center text-sm font-semibold text-sky-800" href="/family">
              家庭入口
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link
                className="travel-label inline-flex min-h-11 items-center rounded-full border border-emerald-200 bg-white px-3 py-2 text-xs font-semibold text-emerald-900"
                href="/family/capture"
              >
                Capture
              </Link>
              <Link
                className="travel-label inline-flex min-h-11 items-center rounded-full border border-sky-200 bg-white px-3 py-2 text-xs font-semibold text-sky-900"
                href="/trips/admin"
              >
                Travel admin
              </Link>
            </div>
          </div>
          <div>
            <p className="travel-label text-sm font-semibold uppercase text-sky-700">TravelOS</p>
            <h1 className="travel-display mt-2 text-4xl font-semibold">Write</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              倉庫裡的 Moment 當素材。用日子和地點找出一組照片，就可以一起寫。工作只指出要用哪些照片。空白寫字區只放人手打的字，不會產生文章。
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[18rem_1fr] lg:px-10">
        <aside className="rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
          <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Jobs</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">Open a job</h2>
          <div className="mt-4 grid gap-2">
            {jobs.length > 0 ? (
              jobs.map((job) => (
                <button
                  className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                    job.id === activeJob?.id
                      ? "border-sky-300 bg-sky-50 text-sky-950"
                      : "border-zinc-200 bg-white text-zinc-700 hover:bg-sky-50/60"
                  }`}
                  key={job.id}
                  onClick={() => openJob(job.id)}
                  type="button"
                >
                  <span className="block font-semibold">{job.momentIds.length} moments</span>
                  <span className="mt-1 block text-xs text-zinc-500">{job.command}</span>
                </button>
              ))
            ) : (
              <p className="text-sm leading-6 text-zinc-600">還沒有工作。Capture 裡的交代會出現在這裡。</p>
            )}
          </div>

          <p className="travel-label mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Moment assets</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">Warehouse</h2>
          <div className="mt-4 grid gap-3">
            <label className="block">
              <span className="travel-label text-xs font-semibold text-zinc-700">Day</span>
              <select
                className="mt-1 min-h-11 w-full rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-950"
                onChange={(event) => changeDayFilter(event.target.value)}
                value={dayFilter}
              >
                <option value="">All days</option>
                {availableDays.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="travel-label text-xs font-semibold text-zinc-700">Place</span>
              <select
                className="mt-1 min-h-11 w-full rounded-2xl border border-sky-200 bg-white px-3 py-2 text-sm text-zinc-950"
                onChange={(event) => changePlaceFilter(event.target.value)}
                value={placeFilter}
              >
                <option value="">All places</option>
                {availablePlaces.map((place) => (
                  <option key={place} value={place}>
                    {place}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 grid gap-2">
            {moments.length === 0 ? (
              <p className="text-sm leading-6 text-zinc-600">還沒有 Moment 素材。</p>
            ) : visibleWarehouseMoments.length > 0 ? (
              visibleWarehouseMoments.map((moment) => {
                const places = momentPlaceLabels(moment);
                return (
                  <button
                    className={`rounded-2xl border px-3 py-3 text-left text-sm transition ${
                      activeJob
                        ? "border-zinc-200 bg-white text-zinc-700 hover:bg-sky-50/60"
                        : usingFoundSet
                          ? "border-sky-200 bg-sky-50/70 text-sky-950"
                          : moment.id === activeMoment?.id
                            ? "border-sky-300 bg-sky-50 text-sky-950"
                            : "border-zinc-200 bg-white text-zinc-700 hover:bg-sky-50/60"
                    }`}
                    key={moment.id}
                    onClick={() => openMoment(moment.id)}
                    type="button"
                  >
                    <span className="block font-semibold">{momentCalendarDay(moment)}</span>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {places.length > 0 ? places.join(" · ") : "no place yet"} / {moment.photos.length} photos
                      {moment.note ? ` / ${moment.note}` : ""}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="text-sm leading-6 text-zinc-600">這個日子或地點沒有 Moment。</p>
            )}
          </div>
        </aside>

        <article className="rounded-3xl border border-sky-100 bg-white p-5 shadow-sm sm:p-6">
          {hasWritingTarget ? (
            <>
              {activeJob ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">Job</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-800">{activeJob.command}</p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">這是工作，不是日記。下面空白處才是你要寫的字。</p>
                </div>
              ) : usingFoundSet ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                  <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-sky-800">Found set</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-800">
                    {visibleWarehouseMoments.length} moments
                    {dayFilter ? ` · ${dayFilter}` : ""}
                    {placeFilter ? ` · ${placeFilter}` : ""}
                  </p>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">這些照片是這次找到的素材。下面空白處才是你要寫的字。</p>
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {writingPhotos.length > 0 ? (
                  writingPhotos.map((photo) => {
                    const visible = !hiddenPhotoIds.includes(photo.id);
                    return (
                      <figure className={`overflow-hidden rounded-2xl bg-stone-100 ${visible ? "" : "opacity-40"}`} key={photo.id}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt="" className="h-40 w-full object-cover" src={momentPhotoPlayUrl(photo.momentId, photo.id)} />
                        <button
                          className="flex min-h-11 w-full items-center justify-center bg-white text-xs font-semibold text-zinc-800"
                          onClick={() => togglePhoto(photo.id)}
                          type="button"
                        >
                          {visible ? "Keep visible" : "Show photo"}
                        </button>
                      </figure>
                    );
                  })
                ) : (
                  <p className="text-sm text-zinc-600">這些素材還沒有照片。</p>
                )}
              </div>

              {visiblePhotos.length === 0 && writingPhotos.length > 0 ? (
                <p className="mt-3 text-sm text-zinc-500">目前沒有可見照片。點 Show photo 讓照片回到寫作區。</p>
              ) : null}

              <label className="mt-6 block">
                <span className="travel-label text-sm font-semibold text-zinc-700">Writing</span>
                <textarea
                  className="mt-2 min-h-64 w-full rounded-2xl border border-sky-200 bg-[#fffdf8] px-4 py-3 text-base leading-7 text-zinc-950 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  onChange={(event) => setDraft(event.target.value)}
                  value={draft}
                />
              </label>

              <label className="mt-4 block">
                <span className="travel-label text-sm font-semibold text-zinc-700">Also save onto an existing trip</span>
                <select
                  className="mt-2 min-h-12 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-sm text-zinc-950"
                  onChange={(event) => setAttachTripId(event.target.value)}
                  value={attachTripId}
                >
                  <option value="">Only keep the draft here</option>
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </select>
              </label>

              <p aria-live="polite" className="mt-3 text-sm leading-6 text-zinc-600">
                {message}
              </p>

              <button
                className="mt-5 min-h-12 w-full rounded-2xl border border-sky-300 bg-sky-50 px-4 py-3 font-semibold text-sky-950 disabled:opacity-60 sm:w-auto"
                disabled={saving}
                onClick={() => void saveWriting()}
                type="button"
              >
                {saving ? "Saving…" : "Save writing"}
              </button>
            </>
          ) : (
            <p className="text-sm leading-6 text-zinc-600">{message}</p>
          )}
        </article>
      </section>
    </main>
  );
}
