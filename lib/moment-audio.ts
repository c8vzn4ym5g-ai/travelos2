export const UNPLAYABLE_MOMENT_AUDIO_COPY = "這段聲音還不能播。";
export const MOMENT_AUDIO_PLAY_PATH = "/api/moments/audio";

const recorderMimeCandidates = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/aac",
  "audio/webm;codecs=opus",
  "audio/webm",
];

const fragmentedMp4Brands = new Set(["iso5", "iso6", "iso7", "iso8", "iso9", "hlsf", "cmfc", "dash", "msdh", "msix"]);

export function sniffAudioMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) {
    return null;
  }

  if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return "audio/mp4";
  }

  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) {
    return "audio/webm";
  }

  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return "audio/mpeg";
  }

  if (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) {
    return "audio/mpeg";
  }

  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x41 &&
    bytes[10] === 0x56 &&
    bytes[11] === 0x45
  ) {
    return "audio/wav";
  }

  if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
    return "audio/ogg";
  }

  return null;
}

export function normalizeAudioMime(value: string | null | undefined) {
  const mime = value?.split(";")[0]?.trim().toLowerCase() ?? "";
  if (mime === "video/webm" || mime === "audio/webm") {
    return "audio/webm";
  }
  if (mime === "video/mp4" || mime === "audio/mp4" || mime === "audio/x-m4a" || mime === "audio/aac") {
    return "audio/mp4";
  }
  if (mime === "audio/mpeg" || mime === "audio/mp3") {
    return "audio/mpeg";
  }
  if (mime === "audio/wav" || mime === "audio/x-wav" || mime === "audio/wave") {
    return "audio/wav";
  }
  if (mime === "audio/ogg" || mime === "audio/opus") {
    return "audio/ogg";
  }
  return mime || null;
}

export function resolveAudioMime(bytes: Uint8Array, declared?: string | null) {
  return sniffAudioMime(bytes) ?? normalizeAudioMime(declared);
}

export function filenameForAudioMime(mime: string | null | undefined) {
  const normalized = normalizeAudioMime(mime) ?? mime;
  if (normalized === "audio/mp4") {
    return "moment-audio.m4a";
  }
  if (normalized === "audio/mpeg") {
    return "moment-audio.mp3";
  }
  if (normalized === "audio/wav") {
    return "moment-audio.wav";
  }
  if (normalized === "audio/ogg") {
    return "moment-audio.ogg";
  }
  return "moment-audio.webm";
}

export function preferredRecorderMime() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }

  return recorderMimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function canPlayAudioMime(mime: string | null | undefined) {
  if (!mime || typeof Audio === "undefined") {
    return false;
  }

  try {
    return Boolean(new Audio().canPlayType(mime));
  } catch {
    return false;
  }
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

export function readFtypBrands(bytes: Uint8Array) {
  if (bytes.length < 12 || bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) {
    return [] as string[];
  }

  const brands = [ascii(bytes, 8, 4)];
  const size = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  const end = size >= 16 ? Math.min(bytes.length, size) : Math.min(bytes.length, 32);
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    brands.push(ascii(bytes, offset, 4));
  }
  return brands;
}

export function isFragmentedMp4(bytes: Uint8Array) {
  if (sniffAudioMime(bytes) !== "audio/mp4") {
    return false;
  }

  if (readFtypBrands(bytes).some((brand) => fragmentedMp4Brands.has(brand))) {
    return true;
  }

  const limit = Math.min(bytes.length - 8, 65_536);
  for (let offset = 0; offset <= limit; ) {
    const size = ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
    if (ascii(bytes, offset + 4, 4) === "moof") {
      return true;
    }
    const next = size >= 8 ? offset + size : offset + 8;
    if (next <= offset) {
      return false;
    }
    offset = next;
  }

  return false;
}

export function cloneAudioBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

export function fileFromAudioBytes(bytes: Uint8Array, declared?: string | null) {
  const mime = resolveAudioMime(bytes, declared) ?? declared ?? "application/octet-stream";
  return new File([cloneAudioBytes(bytes)], filenameForAudioMime(mime), { type: mime });
}

export async function copyAudioBytes(blob: Blob) {
  const independent = blob.slice(0);
  return new Uint8Array(await independent.arrayBuffer());
}

export function encodeWavBytes(channelData: Float32Array[], sampleRate: number) {
  const numChannels = Math.max(1, channelData.length);
  const length = channelData[0]?.length ?? 0;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset + index, value.charCodeAt(index));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let index = 0; index < length; index += 1) {
    for (let channel = 0; channel < numChannels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel]?.[index] ?? 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Uint8Array(buffer);
}

export function momentAudioPlayUrl(momentId: string) {
  return `${MOMENT_AUDIO_PLAY_PATH}?momentId=${encodeURIComponent(momentId)}`;
}

export function isTrustedMomentAudioUrl(value: string) {
  if (value.startsWith("drive:") && value.slice("drive:".length).trim()) {
    return true;
  }

  try {
    const url = new URL(value);
    if (url.protocol === "data:") {
      return /^(audio|video|application)\//.test(url.pathname);
    }
    if (url.protocol !== "https:") {
      return false;
    }
    return (
      url.hostname === "blob.vercel-storage.com" ||
      url.hostname.endsWith(".blob.vercel-storage.com") ||
      url.hostname.endsWith(".public.blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

export function formatAudioDurationLabel(durationSeconds: number | null | undefined) {
  const seconds = Math.round(durationSeconds ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "這段聲音";
  }
  return `約 ${seconds} 秒`;
}
