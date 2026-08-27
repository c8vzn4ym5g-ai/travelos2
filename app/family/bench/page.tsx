"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders, resolveFamilySession } from "@/lib/family-session";
import type { MomentContent } from "@/lib/moment-store";
import { sortMomentsNewestFirst } from "@/lib/moments";
import type { TravelMoment } from "@/lib/types";

type MomentsResponse = {
  content: MomentContent;
};

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

export default function FamilyBenchPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [moments, setMoments] = useState<TravelMoment[]>([]);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [message, setMessage] = useState("正在打開工作台…");

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

  useEffect(() => {
    if (!authenticated) {
      return;
    }

    let cancelled = false;
    const wantedId = highlightedMomentId();
    setHighlightId(wantedId);

    void (async () => {
      try {
        const response = await fetch("/api/moments", {
          cache: "no-store",
          headers: familyPinHeaders(sessionPin(pin)),
        });
        if (!response.ok) {
          throw new Error("Could not load moments.");
        }

        const data = (await response.json()) as MomentsResponse;
        if (cancelled) {
          return;
        }

        const listed = sortMomentsNewestFirst(data.content.moments ?? []);
        setMoments(listed);
        setMessage(listed.length > 0 ? "剛收下的，還沒整理。旅行和咖啡都還沒進。" : "還沒有收下的。");
      } catch {
        if (!cancelled) {
          setMessage("現在打不開工作台。請再試一次。");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, pin]);

  const listed = useMemo(() => sortMomentsNewestFirst(moments), [moments]);

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

  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
      <section className="border-b border-amber-100 bg-[radial-gradient(circle_at_top_left,_#fde68a_0,_transparent_34%),linear-gradient(180deg,_#fffdf7_0%,_#f8f3ea_100%)]">
        <div className="mx-auto max-w-xl px-6 py-8 lg:px-10">
          <Link className="travel-label inline-flex min-h-11 items-center text-sm font-semibold text-amber-900" href="/family">
            ← 家庭入口
          </Link>
          <p className="travel-script mt-8 text-2xl text-rose-700">family workshop</p>
          <h1 className="travel-display mt-2 text-4xl font-semibold">工作台 / Bench</h1>
          <p className="mt-4 text-base leading-7 text-zinc-600">剛收下的，還沒整理。旅行和咖啡都還沒進。</p>
        </div>
      </section>

      <section className="mx-auto max-w-xl px-6 py-8 lg:px-10">
        <p aria-live="polite" className="mb-5 text-sm leading-6 text-zinc-600">
          {message}
        </p>

        {listed.length === 0 ? (
          <article className="rounded-3xl border border-dashed border-amber-200 bg-white p-6 text-center shadow-sm">
            <p className="text-base leading-7 text-zinc-700">還沒有收下的。</p>
            <Link
              className="mt-5 flex min-h-12 items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 font-semibold text-emerald-950"
              href="/family/capture"
            >
              去 Capture 拍一張
            </Link>
          </article>
        ) : (
          <ul className="grid gap-5">
            {listed.map((moment) => {
              const highlighted = moment.id === highlightId;
              const oneLiner = moment.note.trim();
              const day = formatBenchDay(moment);
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

                    {moment.photos.length > 0 ? (
                      <ul className="mt-4 grid grid-cols-2 gap-3">
                        {moment.photos.map((photo) => (
                          <li className="overflow-hidden rounded-2xl bg-stone-100" key={photo.id}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              alt={photo.originalFilename || ""}
                              className="h-40 w-full object-cover"
                              src={photo.storageKey}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-5 text-sm text-zinc-600">
                        這筆還沒有照片。
                      </p>
                    )}

                    {moment.originalAudioUrl ? (
                      <audio className="mt-4 w-full" controls preload="none" src={moment.originalAudioUrl}>
                        播放聲音
                      </audio>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
