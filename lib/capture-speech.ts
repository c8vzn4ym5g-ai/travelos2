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

function recognitionConstructor() {
  const candidate =
    (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ??
    (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
  return candidate ?? null;
}

export function startCaptureSpeech(onText: (spoken: string) => void) {
  const Recognition = recognitionConstructor();
  if (!Recognition) {
    return { stop() {} };
  }

  const recognition = new Recognition();
  let stopped = false;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "zh-TW";
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
