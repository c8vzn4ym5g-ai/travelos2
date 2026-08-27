"use client";

import {
  cloneAudioBytes,
  copyAudioBytes,
  encodeWavBytes,
  fileFromAudioBytes,
  isFragmentedMp4,
  resolveAudioMime,
} from "./moment-audio.ts";

const DECODE_MS = 8000;

type BrowserAudioContext = AudioContext & { resume(): Promise<void> };

let primedContext: BrowserAudioContext | null = null;

function audioContextConstructor() {
  const candidate = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return candidate ?? null;
}

export function primePlaybackAudioContext() {
  const Context = audioContextConstructor();
  if (!Context) {
    return null;
  }

  primedContext ??= new Context() as BrowserAudioContext;
  void primedContext.resume();
  return primedContext;
}

async function decodeAudioBuffer(context: AudioContext, buffer: ArrayBuffer) {
  return new Promise<AudioBuffer>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      action();
    };

    try {
      const result = context.decodeAudioData(
        buffer,
        (decoded) => finish(() => resolve(decoded)),
        (error) => finish(() => reject(error ?? new Error("decode failed"))),
      );
      if (result && typeof result.then === "function") {
        result.then(
          (decoded) => finish(() => resolve(decoded)),
          (error) => finish(() => reject(error)),
        );
      }
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export async function decodeToWavFile(bytes: Uint8Array, timeoutMs = DECODE_MS) {
  const context = primePlaybackAudioContext();
  if (!context) {
    throw new Error("no audio context");
  }

  const copy = cloneAudioBytes(bytes);
  const decoded = await Promise.race([
    decodeAudioBuffer(context, copy.buffer as ArrayBuffer),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("decode timeout")), timeoutMs);
    }),
  ]);

  const channels: Float32Array[] = [];
  for (let index = 0; index < decoded.numberOfChannels; index += 1) {
    channels.push(decoded.getChannelData(index));
  }

  const wav = encodeWavBytes(channels, decoded.sampleRate);
  return {
    bytes: wav,
    durationSeconds: Math.max(1, Math.round(decoded.duration)),
    file: new File([wav], "moment-audio.wav", { type: "audio/wav" }),
  };
}

export async function preparePlayableAudio(blob: Blob) {
  const bytes = await copyAudioBytes(blob);
  const mime = resolveAudioMime(bytes, blob.type);
  const file = fileFromAudioBytes(bytes, mime ?? blob.type);

  if (!isFragmentedMp4(bytes)) {
    return { bytes, durationSeconds: null as number | null, file, transcoded: false };
  }

  try {
    const wav = await decodeToWavFile(bytes);
    return {
      bytes: wav.bytes,
      durationSeconds: wav.durationSeconds,
      file: wav.file,
      transcoded: true,
    };
  } catch {
    return { bytes, durationSeconds: null as number | null, file, transcoded: false };
  }
}

export async function transcodeBytesToWavFile(bytes: Uint8Array) {
  if (!isFragmentedMp4(bytes)) {
    return null;
  }

  try {
    return await decodeToWavFile(bytes);
  } catch {
    return null;
  }
}
