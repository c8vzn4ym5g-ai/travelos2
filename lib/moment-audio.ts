export const UNPLAYABLE_MOMENT_AUDIO_COPY = "這段聲音還不能播。";

const recorderMimeCandidates = [
  "audio/mp4",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/aac",
  "audio/webm;codecs=opus",
  "audio/webm",
];

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
