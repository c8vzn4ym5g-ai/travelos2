"use client";

import { CAPTURE_SPEECH_LANGS, type CaptureSpeechLangId } from "@/lib/capture-speech";

type CaptureSpeechLangChipsProps = {
  onChange: (next: CaptureSpeechLangId) => void;
  value: CaptureSpeechLangId;
};

export function CaptureSpeechLangChips({ onChange, value }: CaptureSpeechLangChipsProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="說話的語言">
      {CAPTURE_SPEECH_LANGS.map((option) => {
        const selected = value === option.id;
        return (
          <button
            aria-checked={selected}
            className={`family-speech-chip inline-flex min-h-9 min-w-11 items-center justify-center rounded-full border px-3 text-sm ${
              selected ? "is-selected" : ""
            }`}
            key={option.id}
            onClick={() => onChange(option.id)}
            role="radio"
            type="button"
          >
            {option.chip}
          </button>
        );
      })}
    </div>
  );
}
