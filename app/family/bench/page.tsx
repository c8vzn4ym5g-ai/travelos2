"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BenchAudio } from "@/app/family/bench/bench-audio";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders, resolveFamilySession } from "@/lib/family-session";
import type { MomentContent } from "@/lib/moment-store";
import { momentNeedsTranscript, momentPhotoPlayUrl, sortMomentsNewestFirst } from "@/lib/moments";
import type { TravelMoment } from "@/lib/types";

type MomentsResponse = {
  content: MomentContent;
};

type LoadState = "session" | "loading" | "ready" | "error";

const BENCH_INTRO = "剛收下的，還沒整理。旅行和咖啡都還沒進。";
const SESSION_MS = 5000;
const MOMENTS_MS = 8000;
const TRANSCRIPT_POLL_MS = 4000;
const TRANSCRIPT_POLL_FOR_MS = 40000;
const TRANSCRIPT_FILL_MS = 55000;
const TRANSCRIPT_FILL_LIMIT = 3;

function sessionPin(fallback: string) {
  return window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? fallback;
}

function formatBenchDay(moment: TravelMoment) {
  const raw = moment.createdAt || moment.time;
  if (!raw) {
    return "";
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("zh-Hant", {
    day: "numeric",
    month: "numeric",
    timeZone: "Asia/Taipei",
  }).formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return month && day ? `${month}月${day}日` : "";
}

function highlightedMomentId() {
  return new URLSearchParams(window.location.search).get("moment")?.trim() || null;
}

function mergeTranscripts(current: TravelMoment[], incoming: TravelMoment[]) {
  if (current.length === 0) {
    return incoming;
  }

  const byId = new Map(incoming.map((moment) => [moment.id, moment]));
  return current.map((moment) => byId.get(moment.id) ?? moment);
}

export default function FamilyBenchPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [moments, setMoments] = useState<TravelMoment[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("session");
  const [message, setMessage] = useState("正在打開工作台…");

  const listed = useMemo(() => sortMomentsNewestFirst(moments), [moments]);

  const fillSpokenText = useCallback(async (pinValue: string, current: TravelMoment[]) => {
    const waiting = sortMomentsNewestFirst(current.filter((moment) => momentNeedsTranscript(moment))).slice(
      0,
      TRANSCRIPT_FILL_LIMIT,
    );
    if (waiting.length === 0) {
      return;
    }

    try {
      const response = await fetch("/api/moments/transcript", {
        body: JSON.stringify({ momentIds: waiting.map((moment) => moment.id) }),
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          ...familyPinHeaders(sessionPin(pinValue)),
        },
        method: "POST",
        signal: AbortSignal.timeout(TRANSCRIPT_FILL_MS),
      });
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { moment?: TravelMoment | null; moments?: TravelMoment[] };
      const incoming = data.moments ?? (data.moment ? [data.moment] : []);
      if (incoming.length === 0) {
        return;
      }

      setMoments((listedMoments) => mergeTranscripts(listedMoments, incoming));
    } catch {
      // Background fill must never block or spin the bench.
    }
  }, []);

  const loadMoments = useCallback(async (pinValue: string, options: { quiet?: boolean } = {}) => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), MOMENTS_MS);

    try {
      if (!options.quiet) {
        setLoadState((current) => (current === "ready" ? current : "loading"));
        setMessage("正在打開工作台…");
      }

      const response = await fetch("/api/moments", {
        cache: "no-store",
        headers: familyPinHeaders(sessionPin(pinValue)),
        signal: controller.signal,
      });

      if (response.status === 401) {
        setRedirecting(true);
        router.replace("/family");
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load moments.");
      }

      const data = (await response.json()) as MomentsResponse;
      const next = sortMomentsNewestFirst(data.content.moments ?? []);
      setMoments((current) => (options.quiet ? mergeTranscripts(current, next) : next));
      setLoadState("ready");
      setMessage(next.length > 0 ? "" : "還沒有收下的。");
      if (!options.quiet) {
        void fillSpokenText(pinValue, next);
      }
    } catch {
      setLoadState((current) => {
        if (current === "ready") {
          return current;
        }
        return "error";
      });
      setMessage((currentMessage) => {
        if (options.quiet) {
          return currentMessage;
        }
        return "現在打不開工作台。請再試一次。";
      });
    } finally {
      window.clearTimeout(timer);
    }
  }, [fillSpokenText, router]);

  useEffect(() => {
    let cancelled = false;
    const failOpen = window.setTimeout(() => {
      if (cancelled) {
        return;
      }
      setAuthenticated(true);
      setLoadState("loading");
    }, SESSION_MS);

    void resolveFamilySession().then((session) => {
      if (cancelled) {
        return;
      }
      window.clearTimeout(failOpen);

      if (session.allowed) {
        setPin(session.pin);
        setAuthenticated(true);
        setLoadState("loading");
        return;
      }

      setRedirecting(true);
      router.replace("/family");
    });

    return () => {
      cancelled = true;
      window.clearTimeout(failOpen);
    };
  }, [router]);

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    setHighlightId(highlightedMomentId());
    void loadMoments(pin);
  }, [authenticated, loadMoments, pin]);

  useEffect(() => {
    if (loadState !== "ready") {
      return;
    }

    const waiting = listed.some(momentNeedsTranscript);
    if (!waiting) {
      return;
    }

    const poll = window.setInterval(() => {
      void loadMoments(pin, { quiet: true });
    }, TRANSCRIPT_POLL_MS);
    const stop = window.setTimeout(() => {
      window.clearInterval(poll);
    }, TRANSCRIPT_POLL_FOR_MS);

    return () => {
      window.clearInterval(poll);
      window.clearTimeout(stop);
    };
  }, [listed, loadMoments, loadState, pin]);

  useEffect(() => {
    if (!highlightId) {
      return;
    }

    const node = document.getElementById(highlightId);
    node?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [highlightId, listed]);

  if (!authenticated) {
    return (
      <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
        <section className="mx-auto max-w-md px-6 py-8 lg:px-10">
          <div className="rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm">
            <p className="travel-label text-sm font-semibold text-amber-900">
              {redirecting ? "正在返回家庭登入…" : "正在開啟工作台…"}
            </p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {redirecting ? "工作台使用同一個家庭密碼，不會另外開密碼表單。" : "家庭入口開啟中，不必先輸入密碼。"}
            </p>
          </div>
        </section>
      </main>
    );
  }

  const showEmptyWarehouse = loadState === "ready" && listed.length === 0;
  const showCards = listed.length > 0;

  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
      <section className="border-b border-amber-100 bg-[radial-gradient(circle_at_top_left,_#fde68a_0,_transparent_34%),linear-gradient(180deg,_#fffdf7_0%,_#f8f3ea_100%)]">
        <div className="mx-auto max-w-xl px-6 py-8 lg:px-10">
          <Link className="travel-label inline-flex min-h-11 items-center text-sm font-semibold text-amber-900" href="/family">
            ← 家庭入口
          </Link>
          <p className="travel-script mt-8 text-2xl text-rose-700">family workshop</p>
          <h1 className="travel-display mt-2 text-4xl font-semibold">工作台 / Bench</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">{BENCH_INTRO}</p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-6 py-8 lg:px-10">
        {message ? (
          <p aria-live="polite" className="mb-5 text-sm leading-6 text-zinc-600">
            {message}
          </p>
        ) : null}

        {showEmptyWarehouse ? (
          <article className="rounded-3xl border border-dashed border-amber-200 bg-white p-6 text-center shadow-sm">
            <p className="text-base leading-7 text-zinc-700">還沒有收下的。</p>
            <Link
              className="mt-5 flex min-h-12 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-950"
              href="/family/capture"
            >
              去 Capture 拍一張
            </Link>
          </article>
        ) : null}

        {!showCards && !showEmptyWarehouse ? (
          <article className="rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm leading-6 text-zinc-600">
              {loadState === "error" ? "現在打不開工作台。請再試一次。" : "正在打開工作台…"}
            </p>
            {loadState === "error" ? (
              <button
                className="mt-5 flex min-h-12 w-full items-center justify-center rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 font-semibold text-amber-950"
                onClick={() => void loadMoments(pin)}
                type="button"
              >
                再試一次
              </button>
            ) : null}
          </article>
        ) : null}

        {showCards ? (
          <ul className="grid gap-5">
            {listed.map((moment) => {
              const highlighted = moment.id === highlightId;
              const oneLiner = moment.note.trim();
              const spoken = moment.transcript?.trim() ?? "";
              const day = formatBenchDay(moment);
              const hasPhotos = moment.photos.length > 0;
              const hasAudio = Boolean(moment.originalAudioUrl);
              return (
                <li key={moment.id}>
                  <article
                    className={`scroll-mt-4 rounded-3xl border p-5 shadow-sm ${
                      highlighted ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300" : "border-amber-200 bg-white"
                    }`}
                    id={moment.id}
                  >
                    {day ? <p className="travel-label text-sm font-semibold text-amber-900">{day}</p> : null}
                    {oneLiner ? <p className="mt-2 text-base leading-7 text-zinc-800">{oneLiner}</p> : null}
                    {spoken ? <p className="mt-3 text-base leading-7 text-zinc-700">{spoken}</p> : null}

                    {hasPhotos ? (
                      <ul className="mt-4 grid grid-cols-2 gap-3">
                        {moment.photos.map((photo) => (
                          <li className="overflow-hidden rounded-2xl bg-stone-100" key={photo.id}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt={photo.originalFilename || ""}
                              className="h-40 w-full object-cover"
                              src={momentPhotoPlayUrl(moment.id, photo.id)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : null}

                    {!hasPhotos && !hasAudio && !spoken ? (
                      <p className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-5 text-sm text-zinc-600">
                        這筆還沒有照片。
                      </p>
                    ) : null}

                    {hasAudio ? <BenchAudio momentId={moment.id} /> : null}
                  </article>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>
    </main>
  );
}
