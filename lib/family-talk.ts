import { getCloudflareContext } from "@opennextjs/cloudflare";
import { pickAcceptedSpeechLang, spokenTextFromSpeechEvent } from "@/lib/capture-speech";
import { isAdminPinValid } from "@/lib/family-pin";

export type TalkLang = "zh" | "ja";
export type TalkMode = "zh-to-ja" | "ja-to-zh";

export const TALK_WHISPER_TURBO = "@cf/openai/whisper-large-v3-turbo";
export const TALK_WHISPER = "@cf/openai/whisper";
export const TALK_SPOKEN_LLM = "@cf/meta/llama-3.2-3b-instruct";
export const TALK_M2M = "@cf/meta/m2m100-1.2b";

export const TALK_MAX_AUDIO_BYTES = 8 * 1024 * 1024;

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> }) => void) | null;
  start: () => void;
  stop: () => void;
};

export type FamilyTalkAi = {
  run: (model: string, inputs: Record<string, unknown>) => Promise<unknown>;
};

export type SpeechVoiceLike = {
  lang: string;
  name: string;
};

const JA_VOICE_NAMES = ["kyoko", "o-ren", "oren", "o‑ren", "siri"];
const ZH_VOICE_NAMES = ["meijia", "mei-jia", "ting-ting", "tingting", "sinji", "siri"];

export function talkSourceLang(mode: TalkMode): TalkLang {
  return mode === "zh-to-ja" ? "zh" : "ja";
}

export function talkTargetLang(mode: TalkMode): TalkLang {
  return mode === "zh-to-ja" ? "ja" : "zh";
}

export function talkChineseRecognitionLang(
  Recognition?: (new () => Pick<SpeechRecognitionLike, "lang">) | null,
) {
  return pickAcceptedSpeechLang(["zh-TW", "zh-CN"], Recognition);
}

export function recognitionLangForTalk(
  mode: TalkMode,
  Recognition?: (new () => Pick<SpeechRecognitionLike, "lang">) | null,
) {
  return mode === "zh-to-ja" ? talkChineseRecognitionLang(Recognition) : "ja-JP";
}

export function whisperLanguageFor(lang: TalkLang) {
  return lang === "ja" ? "ja" : "zh";
}

export function speakLangCandidates(lang: TalkLang) {
  return lang === "ja" ? ["ja-JP", "ja"] : ["zh-TW", "zh-CN", "zh-HK", "zh"];
}

export function pickSpeechVoice<T extends SpeechVoiceLike>(voices: readonly T[], lang: TalkLang): T | null {
  const preferred = lang === "ja" ? JA_VOICE_NAMES : ZH_VOICE_NAMES;
  const matching = voices.filter((voice) => speakLangCandidates(lang).some((tag) => voiceLangMatches(voice.lang, tag)));
  for (const name of preferred) {
    const named = matching.find((voice) => voice.name.toLowerCase().includes(name));
    if (named) {
      return named;
    }
  }
  for (const tag of speakLangCandidates(lang)) {
    const tagged = matching.find((voice) => voiceLangMatches(voice.lang, tag));
    if (tagged) {
      return tagged;
    }
  }
  return matching[0] ?? null;
}

export function voiceLangMatches(voiceLang: string, wanted: string) {
  const left = voiceLang.trim().toLowerCase().replace(/_/g, "-");
  const right = wanted.trim().toLowerCase().replace(/_/g, "-");
  return left === right || left.startsWith(`${right}-`);
}

export function cleanSpokenTranslation(text: string) {
  const firstLine = text
    .replace(/^\s*["「『]+|["」』]+\s*$/g, "")
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^\s*(譯文|译文|翻译|翻譯|日文|中文|Japanese|Chinese)\s*[:：]\s*/i, "")
        .replace(/^\s*["「『]+|["」』]+\s*$/g, "")
        .trim(),
    )
    .find((line) => line.length > 0);

  return (firstLine ?? "").replace(/\s+/g, " ").trim();
}

export function spokenTranslateMessages(text: string, from: TalkLang, to: TalkLang) {
  const fromName = from === "zh" ? "中文" : "日文";
  const toName = to === "zh" ? "中文" : "日文";
  return {
    messages: [
      {
        role: "system",
        content:
          "你是九州旅行現場口譯。只輸出譯文，不要拼音、不要解釋、不要引號、不要前後綴。口語、短、能立刻對店員說。",
      },
      {
        role: "user",
        content: `請把這段${fromName}翻成${toName}：\n${text}`,
      },
    ],
  };
}

export function m2mLangNames(lang: TalkLang) {
  return lang === "ja" ? ["japanese", "ja"] : ["chinese", "zh"];
}

export function readAiText(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) {
    return payload.trim();
  }
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as {
    text?: unknown;
    translated_text?: unknown;
    translatedText?: unknown;
    response?: unknown;
    result?: { text?: unknown; response?: unknown };
  };
  const candidates = [record.text, record.translated_text, record.translatedText, record.response, record.result?.text, record.result?.response];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

export function bytesToBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export function isTalkLang(value: unknown): value is TalkLang {
  return value === "zh" || value === "ja";
}

export function parseTalkLang(value: unknown): TalkLang | null {
  if (isTalkLang(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("zh") || normalized.startsWith("cmn") || normalized === "chinese") {
    return "zh";
  }
  if (normalized.startsWith("ja") || normalized === "japanese") {
    return "ja";
  }
  return null;
}

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function handleTalkTranslate(request: Request, ai?: FamilyTalkAi) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  let body: { text?: unknown; from?: unknown; to?: unknown };
  try {
    body = (await request.json()) as { text?: unknown; from?: unknown; to?: unknown };
  } catch {
    return Response.json({ error: "沒有可以翻譯的句子。" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text) {
    return Response.json({ error: "沒有可以翻譯的句子。" }, { status: 400 });
  }
  if (!isTalkLang(body.from) || !isTalkLang(body.to)) {
    return Response.json({ error: "只能中日互譯。" }, { status: 400 });
  }

  try {
    const workerAi = ai ?? (await getFamilyTalkAi());
    const translated = await translateTalkText(workerAi, text, body.from, body.to);
    return Response.json({ source: text, translated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "翻譯沒成功，再試一次。";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function handleTalkTranscribe(request: Request, ai?: FamilyTalkAi) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "沒聽到，再靠近一點、再點一次。" }, { status: 400 });
  }

  const lang = parseTalkLang(form.get("lang"));
  if (!lang) {
    return Response.json({ error: "只能聽中文或日文。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size < 32) {
    return Response.json({ error: "沒聽到，再靠近一點、再點一次。" }, { status: 400 });
  }
  if (file.size > TALK_MAX_AUDIO_BYTES) {
    return Response.json({ error: "這句太長了，短一點再說一次。" }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const workerAi = ai ?? (await getFamilyTalkAi());
    const text = await transcribeTalkAudio(workerAi, bytes, lang);
    return Response.json({ text, lang });
  } catch (error) {
    const message = error instanceof Error ? error.message : "聽不懂這句，再靠近一點、再說一次。";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function getFamilyTalkAi(): Promise<FamilyTalkAi> {
  const { env } = await getCloudflareContext({ async: true });
  const ai = (env as { AI?: FamilyTalkAi }).AI;
  if (!ai || typeof ai.run !== "function") {
    throw new Error("Workers AI 還沒接上。");
  }
  return ai;
}

export async function transcribeTalkAudio(ai: FamilyTalkAi, bytes: Uint8Array, lang: TalkLang) {
  if (bytes.byteLength < 32) {
    throw new Error("沒聽到，再靠近一點、再點一次。");
  }

  const language = whisperLanguageFor(lang);
  const prompt = lang === "ja" ? "これは九州の店員や現地的人が話している日本語です。" : "這是台灣旅客在九州對店員說的中文。";

  const turbo = await runQuiet(ai, TALK_WHISPER_TURBO, {
    audio: bytesToBase64(bytes),
    language,
    task: "transcribe",
    initial_prompt: prompt,
  });
  const turboText = readAiText(turbo);
  if (turboText) {
    return turboText;
  }

  const classic = await runQuiet(ai, TALK_WHISPER, {
    audio: Array.from(bytes),
  });
  const classicText = readAiText(classic);
  if (classicText) {
    return classicText;
  }

  throw new Error("聽不懂這句，再靠近一點、再說一次。");
}

export async function translateTalkText(ai: FamilyTalkAi, text: string, from: TalkLang, to: TalkLang) {
  const spoken = text.replace(/\s+/g, " ").trim();
  if (!spoken) {
    throw new Error("沒有可以翻譯的句子。");
  }
  if (from === to) {
    return spoken;
  }

  const llm = await runQuiet(ai, TALK_SPOKEN_LLM, spokenTranslateMessages(spoken, from, to));
  const llmText = cleanSpokenTranslation(readAiText(llm) ?? "");
  if (llmText && llmText !== spoken) {
    return llmText;
  }

  for (const sourceLang of m2mLangNames(from)) {
    for (const targetLang of m2mLangNames(to)) {
      const raw = await runQuiet(ai, TALK_M2M, {
        text: spoken,
        source_lang: sourceLang,
        target_lang: targetLang,
      });
      const translated = cleanSpokenTranslation(readAiText(raw) ?? "");
      if (translated) {
        return translated;
      }
    }
  }

  if (llmText) {
    return llmText;
  }

  throw new Error("翻譯沒成功，再試一次。");
}

export function recognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }
  const candidate =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
  return candidate ?? null;
}

export function startTalkSpeech(lang: string, onText: (spoken: string) => void) {
  const Recognition = recognitionConstructor();
  if (!Recognition) {
    return null;
  }

  const recognition = new Recognition();
  let stopped = false;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = lang;
  recognition.onresult = (event) => {
    onText(spokenTextFromSpeechEvent(event));
  };
  recognition.onerror = () => {
    // Whisper fallback still has the recording.
  };
  recognition.onend = () => {
    if (stopped) {
      return;
    }
    try {
      recognition.start();
    } catch {
      // iPhone may refuse a restart; recorded audio still goes to Whisper.
    }
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    stop() {
      stopped = true;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // Already stopped.
      }
    },
  };
}

async function runQuiet(ai: FamilyTalkAi, model: string, inputs: Record<string, unknown>) {
  try {
    return await ai.run(model, inputs);
  } catch {
    return null;
  }
}
