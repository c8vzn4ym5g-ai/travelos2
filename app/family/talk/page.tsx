"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { familyPinHeaders, resolveFamilySession } from "@/lib/family-session";
import {
  pickSpeechVoice,
  recognitionConstructor,
  recognitionLangForTalk,
  startTalkSpeech,
  talkSourceLang,
  talkTargetLang,
  type TalkLang,
  type TalkMode,
} from "@/lib/family-talk";
import { preferredRecorderMime } from "@/lib/moment-audio";

type TalkPhase = "ready" | "listening" | "working";
type WakeLockSentinelLike = { release: () => Promise<void> };

function speakLangFor(lang: TalkLang) {
  return lang === "ja" ? "ja-JP" : "zh-TW";
}

function unlockSpeech() {
  if (typeof speechSynthesis === "undefined") {
    return;
  }
  try {
    speechSynthesis.cancel();
    const silent = new SpeechSynthesisUtterance(" ");
    silent.lang = "zh-TW";
    silent.volume = 0;
    silent.rate = 2;
    speechSynthesis.speak(silent);
  } catch {
    // iPhone may ignore a silent unlock; replay still works.
  }
}

function speakText(text: string, lang: TalkLang) {
  if (typeof speechSynthesis === "undefined" || !text.trim()) {
    return;
  }

  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voices = speechSynthesis.getVoices();
  const voice = pickSpeechVoice(voices, lang);
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = speakLangFor(lang);
  }
  utter.rate = 0.95;
  speechSynthesis.speak(utter);
}

async function requestWakeLock() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinelLike> };
    };
    return (await nav.wakeLock?.request("screen")) ?? null;
  } catch {
    return null;
  }
}

export default function FamilyTalkPage() {
  const router = useRouter();
  const pinRef = useRef("");
  const spokenRef = useRef("");
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const stopSpeechRef = useRef<(() => void) | null>(null);
  const wakeRef = useRef<WakeLockSentinelLike | null>(null);
  const modeRef = useRef<TalkMode | null>(null);
  const phaseRef = useRef<TalkPhase>("ready");
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [phase, setPhase] = useState<TalkPhase>("ready");
  const [mode, setMode] = useState<TalkMode | null>(null);
  const [liveText, setLiveText] = useState("");
  const [source, setSource] = useState("");
  const [translated, setTranslated] = useState("");
  const [status, setStatus] = useState("兩顆大按鈕。你說中文，或把手機對準對方。");

  useEffect(() => {
    let cancelled = false;

    void resolveFamilySession().then((session) => {
      if (cancelled) {
        return;
      }
      if (session.allowed) {
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
    if (typeof speechSynthesis === "undefined") {
      return;
    }
    const load = () => {
      speechSynthesis.getVoices();
    };
    load();
    speechSynthesis.addEventListener("voiceschanged", load);
    return () => speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    return () => {
      stopListeningHardware();
    };
  }, []);

  function setTalkPhase(next: TalkPhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function stopListeningHardware() {
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // Already stopped.
      }
    }
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void wakeRef.current?.release();
    wakeRef.current = null;
  }

  async function startListening(nextMode: TalkMode) {
    if (phaseRef.current !== "ready") {
      return;
    }

    unlockSpeech();
    modeRef.current = nextMode;
    setMode(nextMode);
    setTalkPhase("listening");
    setLiveText("");
    spokenRef.current = "";
    chunksRef.current = [];
    setStatus(nextMode === "zh-to-ja" ? "正在聽中文… 說完再點一下停止。" : "正在聽日文… 說完再點一下停止。");

    wakeRef.current = await requestWakeLock();
    const Recognition = recognitionConstructor();
    const lang = recognitionLangForTalk(nextMode, Recognition);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-mic");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = preferredRecorderMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.start(250);
    } catch {
      if (!Recognition) {
        setTalkPhase("ready");
        setMode(null);
        setStatus("請允許麥克風。Safari 會跳出詢問，按允許就可以說。");
        return;
      }
    }

    const session = startTalkSpeech(lang, (spoken) => {
      spokenRef.current = spoken;
      setLiveText(spoken);
    });
    stopSpeechRef.current = session?.stop ?? null;
  }

  async function stopAndTranslate() {
    if (phaseRef.current !== "listening" || !modeRef.current) {
      return;
    }

    unlockSpeech();
    setTalkPhase("working");

    const activeMode = modeRef.current;
    const from = talkSourceLang(activeMode);
    const to = talkTargetLang(activeMode);
    stopSpeechRef.current?.();
    stopSpeechRef.current = null;

    const audio = await stopRecorder();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void wakeRef.current?.release();
    wakeRef.current = null;

    await new Promise((resolve) => window.setTimeout(resolve, 280));
    const spoken = spokenRef.current.trim();

    try {
      let sourceText = spoken;
      if (sourceText) {
        setSource(sourceText);
        setLiveText(sourceText);
        setStatus("正在翻譯…");
      } else {
        setStatus("沒聽到語音辨識，改用備援聽寫…");
        sourceText = await transcribeOnWorker(audio, from);
        if (sourceText) {
          setSource(sourceText);
          setLiveText(sourceText);
          setStatus("正在翻譯…");
        }
      }
      if (!sourceText) {
        throw new Error("沒聽到，再靠近一點、再點一次。");
      }
      const nextTranslation = await translateOnWorker(sourceText, from, to);
      setTranslated(nextTranslation);
      setStatus(to === "ja" ? "正在唸日文給對方聽。" : "正在唸中文給你們聽。");
      speakText(nextTranslation, to);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "沒聽到，再靠近一點、再點一次。");
    } finally {
      setTalkPhase("ready");
    }
  }

  function stopRecorder() {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(new Blob(chunksRef.current));
    }

    return new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/mp4" }));
      };
      try {
        recorder.requestData();
      } catch {
        // Some iPhone recorders ignore requestData.
      }
      try {
        recorder.stop();
      } catch {
        resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/mp4" }));
      }
    });
  }

  async function transcribeOnWorker(blob: Blob, lang: TalkLang) {
    if (blob.size < 32) {
      return "";
    }
    const form = new FormData();
    form.set("file", blob, blob.type.includes("mp4") ? "talk.m4a" : "talk.webm");
    form.set("lang", lang);
    const response = await fetch("/api/family/talk/transcribe", {
      body: form,
      headers: familyPinHeaders(pinRef.current),
      method: "POST",
    });
    const data = (await response.json()) as { error?: string; text?: string };
    if (!response.ok || !data.text?.trim()) {
      throw new Error(data.error || "聽不懂這句，再靠近一點、再說一次。");
    }
    return data.text.trim();
  }

  async function translateOnWorker(text: string, from: TalkLang, to: TalkLang) {
    const response = await fetch("/api/family/talk/translate", {
      body: JSON.stringify({ text, from, to }),
      headers: {
        "content-type": "application/json",
        ...familyPinHeaders(pinRef.current),
      },
      method: "POST",
    });
    const data = (await response.json()) as { error?: string; translated?: string };
    if (!response.ok || !data.translated?.trim()) {
      throw new Error(data.error || "翻譯沒成功，再試一次。");
    }
    return data.translated.trim();
  }

  function replay() {
    if (!translated) {
      return;
    }
    const to = mode ? talkTargetLang(mode) : "ja";
    speakText(translated, to);
    setStatus("再唸一次。");
  }

  function onModeTap(nextMode: TalkMode) {
    if (phaseRef.current === "working") {
      return;
    }
    if (phaseRef.current === "listening") {
      if (modeRef.current === nextMode) {
        void stopAndTranslate();
      }
      return;
    }
    void startListening(nextMode);
  }

  if (!authenticated) {
    return (
      <main className="talk-page">
        <div className="talk-inner">
          <p className="talk-status">{redirecting ? "正在返回家庭登入…" : "正在開啟家庭說話…"}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="talk-page">
      <header className="talk-hero">
        <div className="talk-inner">
          <Link className="talk-back" href="/family">
            回家庭
          </Link>
          <p className="talk-script">kyushu pocket talk</p>
          <h1 className="talk-title">家庭說話</h1>
          <p className="talk-lede">兩顆大按鈕。你說中文，或把手機對準對方。說完再點同一顆，手機會唸出來。</p>
        </div>
      </header>

      <section className="talk-inner">
        <div className="talk-modes">
          <button
            className={`talk-mode talk-mode-zh${mode === "zh-to-ja" && phase === "listening" ? " is-live" : ""}`}
            onClick={() => onModeTap("zh-to-ja")}
            type="button"
          >
            <span className="talk-mode-kicker">
              <span className="talk-face" aria-hidden />
              給店員看日文
            </span>
            <span className="talk-mode-title">我說中文</span>
            <span className="talk-mode-hint">
              {mode === "zh-to-ja" && phase === "listening" ? "點一下停止，然後唸日文" : "點一下開始說，說完再點一下"}
            </span>
          </button>

          <button
            className={`talk-mode talk-mode-ja${mode === "ja-to-zh" && phase === "listening" ? " is-live" : ""}`}
            onClick={() => onModeTap("ja-to-zh")}
            type="button"
          >
            <span className="talk-mode-kicker">
              <span className="talk-face" aria-hidden />
              對準對方
            </span>
            <span className="talk-mode-title">對方說日文</span>
            <span className="talk-mode-hint">
              {mode === "ja-to-zh" && phase === "listening" ? "點一下停止，然後唸中文" : "點一下開始聽，聽完再點一下"}
            </span>
          </button>
        </div>

        {phase === "listening" || liveText || source || translated ? (
          <div className="talk-cards">
            <article className="talk-card">
              <p className="talk-card-label">{mode === "ja-to-zh" ? "對方說的" : "你說的"}</p>
              <p className="talk-live">{liveText || source || (phase === "listening" ? "正在聽…" : "—")}</p>
            </article>
            <article className="talk-card">
              <p className="talk-card-label">{mode === "ja-to-zh" ? "中文" : "日文，拿給對方看"}</p>
              <p className="talk-translation">{translated || (phase === "working" ? "正在翻譯…" : "—")}</p>
              {translated ? (
                <div className="talk-actions">
                  <button className="talk-replay" onClick={replay} type="button">
                    再聽一次
                  </button>
                </div>
              ) : null}
            </article>
          </div>
        ) : null}

        <p className="talk-status">{status}</p>
        <p className="talk-hint">第一次會問麥克風，請按允許。螢幕在聽的時候會盡量不要暗掉。</p>

        <article className="talk-sticker">
          <p className="talk-card-label">裝到主畫面</p>
          <ol>
            <li>用 Safari 打開這一頁。</li>
            <li>點分享按鈕。</li>
            <li>選「加入主畫面」。</li>
          </ol>
        </article>
      </section>
    </main>
  );
}
