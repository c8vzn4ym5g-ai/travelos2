type SpeechResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

export const CAPTURE_SPEECH_LANG_KEY = "travelos.family.capture-speech-lang";

export type CaptureSpeechLangId = "yue" | "cmn" | "en";

export const CAPTURE_SPEECH_LANGS: ReadonlyArray<{
  chip: string;
  id: CaptureSpeechLangId;
}> = [
  { chip: "粵", id: "yue" },
  { chip: "国", id: "cmn" },
  { chip: "EN", id: "en" },
];

const CANTONESE_LANG_CANDIDATES = ["zh-HK", "yue-Hant-HK"] as const;

export function appendSpokenText(current: string, incoming: string) {
  const next = incoming.replace(/\s+/g, " ").trim();
  if (!next) {
    return current.trim();
  }

  const spoken = current.replace(/\s+/g, " ").trim();
  if (!spoken) {
    return next;
  }
  if (spoken.includes(next)) {
    return spoken;
  }
  if (next.includes(spoken)) {
    return next;
  }
  return `${spoken} ${next}`.trim();
}

export function spokenTextFromSpeechEvent(event: SpeechEventLike) {
  let spoken = "";
  for (let index = 0; index < event.results.length; index += 1) {
    const piece = event.results[index]?.[0]?.transcript ?? "";
    spoken = appendSpokenText(spoken, piece);
  }
  return spoken;
}

export function isCaptureSpeechLangId(value: string | null | undefined): value is CaptureSpeechLangId {
  return value === "yue" || value === "cmn" || value === "en";
}

export function readStoredCaptureSpeechLang(storage?: Pick<Storage, "getItem"> | null): CaptureSpeechLangId {
  try {
    const value = storage?.getItem(CAPTURE_SPEECH_LANG_KEY) ?? null;
    return isCaptureSpeechLangId(value) ? value : "cmn";
  } catch {
    return "cmn";
  }
}

export function writeStoredCaptureSpeechLang(
  id: CaptureSpeechLangId,
  storage?: Pick<Storage, "setItem"> | null,
) {
  if (!isCaptureSpeechLangId(id)) {
    return;
  }

  try {
    storage?.setItem(CAPTURE_SPEECH_LANG_KEY, id);
  } catch {
    // Private mode can block localStorage; the tap still applies for this session.
  }
}

export function normalizeSpeechLangTag(tag: string) {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

export function isCantoneseSpeechLang(tag: string) {
  const normalized = normalizeSpeechLangTag(tag);
  return (
    normalized === "zh-hk" ||
    normalized.startsWith("zh-hk-") ||
    normalized.startsWith("yue") ||
    normalized.includes("-hk")
  );
}

export function sameSpeechLang(assigned: string, requested: string) {
  return normalizeSpeechLangTag(assigned) === normalizeSpeechLangTag(requested);
}

export function pickAcceptedSpeechLang(
  candidates: readonly string[],
  Recognition?: (new () => Pick<SpeechRecognitionLike, "lang">) | null,
) {
  const fallback = candidates[0] ?? "zh-HK";
  if (!Recognition) {
    return fallback;
  }

  try {
    const probe = new Recognition();
    for (const tag of candidates) {
      probe.lang = tag;
      if (sameSpeechLang(probe.lang, tag)) {
        return tag;
      }
    }
    for (const tag of candidates) {
      probe.lang = tag;
      if (isCantoneseSpeechLang(probe.lang)) {
        return probe.lang;
      }
    }
  } catch {
    // SpeechRecognition can exist and still refuse a probe instance.
  }

  return fallback;
}

export function cantoneseSpeechLang(
  Recognition?: (new () => Pick<SpeechRecognitionLike, "lang">) | null,
) {
  // Browser Web Speech does not auto-detect like iPhone dictation. Never set
  // lang="" or "auto" — engines then stay on the last / default locale (here,
  // historically zh-TW) and Cantonese comes back as garbage.
  //
  // Cantonese tags this stack may accept:
  // - zh-HK: Chrome and Safari iOS Web Speech both treat this as HK Cantonese.
  //   Assigning recognition.lang = "zh-HK" typically sticks as "zh-HK".
  // - yue-Hant-HK: more precise BCP-47. Chromium sometimes keeps it; Safari
  //   iOS often ignores yue-* and leaves the previous engine (Mandarin if we
  //   started on zh-TW). Probe first so we only send a tag the engine keeps.
  // Prefer zh-HK so 粵 never silently stays zh-TW.
  return pickAcceptedSpeechLang(CANTONESE_LANG_CANDIDATES, Recognition);
}

export function recognitionLangFor(
  id: CaptureSpeechLangId,
  Recognition?: (new () => Pick<SpeechRecognitionLike, "lang">) | null,
) {
  if (id === "en") {
    return "en-US";
  }
  if (id === "yue") {
    return cantoneseSpeechLang(Recognition);
  }
  return "zh-TW";
}

function recognitionConstructor() {
  const candidate =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
  return candidate ?? null;
}

export function startCaptureSpeech(
  onText: (spoken: string) => void,
  options?: { lang?: string },
) {
  const Recognition = recognitionConstructor();
  if (!Recognition) {
    return { stop() {} };
  }

  const recognition = new Recognition();
  let stopped = false;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = options?.lang ?? recognitionLangFor("cmn", Recognition);
  recognition.onresult = (event) => {
    onText(spokenTextFromSpeechEvent(event));
  };
  recognition.onerror = () => {
    // Live speech is optional; original audio remains the source of truth.
  };
  recognition.onend = () => {
    if (stopped) {
      return;
    }
    try {
      recognition.start();
    } catch {
      // iPhone may refuse a restart; server transcript still fills later.
    }
  };

  try {
    recognition.start();
  } catch {
    return { stop() {} };
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
