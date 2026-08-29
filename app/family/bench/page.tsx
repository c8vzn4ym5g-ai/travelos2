"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BenchAudio } from "@/app/family/bench/bench-audio";
import { BenchPhotoThumb } from "@/app/family/bench/bench-photo";
import { FamilyBackLink } from "@/app/family/family-back";
import { SpokenLine } from "@/app/family/spoken-line";
import { updateMomentTranscript } from "@/lib/capture-upload";
import { FAMILY_ADMIN_SESSION_KEY, familyPinHeaders, resolveFamilySession } from "@/lib/family-session";
import type { MomentContent } from "@/lib/moment-store";
import { momentNeedsTranscript, sortMomentsNewestFirst } from "@/lib/moments";
import type { TravelMoment } from "@/lib/types";

type MomentsResponse = {
  content: MomentContent;
};

type LoadState = "session" | "loading" | "ready" | "error";

const BENCH_INTRO = "剛收下的，還沒整理。旅行和咖啡都還沒進。";
const SESSION_MS = 5000;
const MOMENTS_MS = 30000;
const TRANSCRIPT_POLL_MS = 4000;
const TRANSCRIPT_POLL_FOR_MS = 40000;
const TRANSCRIPT_FILL_MS = 55000;
const TRANSCRIPT_FILL_LIMIT = 3;

function sessionPin(fallback: string) {
  return window.sessionStorage.getItem(FAMILY_ADMIN_SESSION_KEY) ?? fallback;
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
  const [spokenDrafts, setSpokenDrafts] = useState<Record<string, string>>({});

  const listed = useMemo(() => sortMomentsNewestFirst(moments), [moments]);

  function editSpokenLine(momentId: string, next: string) {
    setSpokenDrafts((current) => ({ ...current, [momentId]: next }));
  }

  async function commitSpokenLine(momentId: string, next: string) {
    setSpokenDrafts((current) => ({ ...current, [momentId]: next }));
    try {
      const saved = await updateMomentTranscript({
        momentId,
        pin: sessionPin(pin),
        transcript: next,
      });
      setMoments((current) =>
        current.map((item) => (item.id === saved.moment.id ? { ...item, transcript: saved.moment.transcript } : item)),
      );
      setSpokenDrafts((current) => {
        const nextDrafts = { ...current };
        delete nextDrafts[momentId];
        return nextDrafts;
      });
    } catch {
      setMessage("這行還沒寫上。再點一下就好。");
    }
  }

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
      <main className="fam-page">
        <div className="fam-splash">
          <div className="fam-splash-card">
            <p className="fam-label">{redirecting ? "正在返回家庭登入…" : "正在開啟工作台…"}</p>
            <p className="fam-muted mt-3">
              {redirecting ? "工作台使用同一個家庭密碼，不會另外開密碼表單。" : "家庭入口開啟中，不必先輸入密碼。"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const showEmptyWarehouse = loadState === "ready" && listed.length === 0;
  const showCards = listed.length > 0;

  return (
    <main className="fam-page">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <FamilyBackLink className="min-h-11" href="/family">
            ← 家庭入口
          </FamilyBackLink>
          <p className="fam-script">family workshop</p>
          <h1 className="fam-title">工作台 / Bench</h1>
          <p className="fam-lede">{BENCH_INTRO}</p>
        </div>
      </header>

      <section className="fam-sheet">
        {message ? (
          <p aria-live="polite" className="fam-muted mb-5">
            {message}
          </p>
        ) : null}

        {showEmptyWarehouse ? (
          <article className="fam-empty fam-empty-honey">
            <p className="fam-lede" style={{ marginTop: 0 }}>
              還沒有收下的。
            </p>
            <Link className="fam-pill fam-pill-blush mt-5 w-full" href="/family/capture">
              去 Capture 拍一張
            </Link>
          </article>
        ) : null}

        {!showCards && !showEmptyWarehouse ? (
          <article className="fam-card p-6 text-center">
            <p className="fam-muted">
              {loadState === "error" ? "現在打不開工作台。請再試一次。" : "正在打開工作台…"}
            </p>
            {loadState === "error" ? (
              <button
                className="fam-pill fam-pill-honey mt-5 w-full"
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
              const hasPhotos = moment.photos.length > 0;
              const hasAudio = Boolean(moment.originalAudioUrl);
              return (
                <li key={moment.id}>
                  <article className={`fam-moment scroll-mt-4${highlighted ? " fam-moment-hot" : ""}`} id={moment.id}>
                    <div className="fam-stickers">
                      <span className="fam-sticker-chip fam-sticker-honey">剛收下</span>
                      <span className="fam-sticker-chip fam-sticker-sky">還不用分類</span>
                    </div>
                    {oneLiner ? <p className="fam-voice" style={{ marginTop: 0 }}>{oneLiner}</p> : null}
                    {hasAudio || spoken || spokenDrafts[moment.id] !== undefined ? (
                      <SpokenLine
                        onChange={(next) => editSpokenLine(moment.id, next)}
                        onCommit={(next) => void commitSpokenLine(moment.id, next)}
                        value={spokenDrafts[moment.id] ?? spoken}
                      />
                    ) : null}

                    {hasPhotos ? (
                      <ul className="mt-4 grid grid-cols-2 gap-3">
                        {moment.photos.map((photo) => (
                          <BenchPhotoThumb key={photo.id} momentId={moment.id} photo={photo} />
                        ))}
                      </ul>
                    ) : null}

                    {!hasPhotos && !hasAudio && !spoken ? (
                      <p className="fam-empty-line">這筆還沒有照片。</p>
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
