import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  filenameForAudioMime,
  resolveAudioMime,
  sniffAudioMime,
} from "../lib/moment-audio.ts";
import { momentNeedsTranscript, transcribeAudioBytes } from "../lib/moment-transcript.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

function mp4Header() {
  const bytes = new Uint8Array(24);
  bytes[4] = 0x66;
  bytes[5] = 0x74;
  bytes[6] = 0x79;
  bytes[7] = 0x70;
  bytes[8] = 0x69;
  bytes[9] = 0x73;
  bytes[10] = 0x6f;
  bytes[11] = 0x35;
  return bytes;
}

function webmHeader() {
  return new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]);
}

test("iPhone fmp4 audio labeled webm is sniffed as audio/mp4", () => {
  const bytes = mp4Header();
  assert.equal(sniffAudioMime(bytes), "audio/mp4");
  assert.equal(resolveAudioMime(bytes, "video/webm"), "audio/mp4");
  assert.equal(filenameForAudioMime("audio/mp4"), "moment-audio.m4a");
});

test("real WebM stays audio/webm", () => {
  assert.equal(sniffAudioMime(webmHeader()), "audio/webm");
  assert.equal(filenameForAudioMime("audio/webm"), "moment-audio.webm");
});

test("moments with audio and no transcript still keep the audio as source of truth", () => {
  assert.equal(
    momentNeedsTranscript({ originalAudioUrl: "https://blob.local/voice.webm", transcript: null }),
    true,
  );
  assert.equal(
    momentNeedsTranscript({ originalAudioUrl: "https://blob.local/voice.webm", transcript: "  " }),
    true,
  );
  assert.equal(
    momentNeedsTranscript({ originalAudioUrl: "https://blob.local/voice.webm", transcript: "咖哩好吃" }),
    false,
  );
  assert.equal(momentNeedsTranscript({ originalAudioUrl: null, transcript: null }), false);
});

test("gateway transcription reads text and never treats audio as the transcript", async () => {
  const calls = [];
  const request = async (input, init) => {
    calls.push({ input: String(input), init });
    return Response.json({ text: "  今天的咖哩很好吃。  " });
  };

  const text = await transcribeAudioBytes(mp4Header(), "video/webm", { AI_GATEWAY_API_KEY: "test-key" }, request);
  assert.equal(text, "今天的咖哩很好吃。");
  assert.equal(calls.length, 1);
  assert.match(String(calls[0]?.input), /transcription-model/);
  assert.equal(calls[0]?.init?.headers?.["ai-model-id"], "openai/whisper-1");
  const body = JSON.parse(String(calls[0]?.init?.body));
  assert.equal(body.mediaType, "audio/mp4");
  assert.ok(typeof body.audio === "string" && body.audio.length > 0);
});

test("transcription is a no-op without credentials", async () => {
  const calls = [];
  const request = async (input) => {
    calls.push(String(input));
    return new Response("no", { status: 500 });
  };

  const text = await transcribeAudioBytes(mp4Header(), "audio/mp4", {}, request);
  assert.equal(text, null);
  assert.equal(calls.length, 0);
});

test("capture and audio upload sniff mime instead of forcing webm", async () => {
  const [capture, upload, audioApi] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/audio/route.ts"),
  ]);

  assert.match(capture, /preferredRecorderMime/);
  assert.match(capture, /MediaRecorder\(stream, \{ mimeType: recorderMime \}\)/);
  assert.match(upload, /filenameForAudioMime/);
  assert.match(upload, /resolveAudioMime/);
  assert.doesNotMatch(upload, /moment-audio\.webm"\)/);
  assert.match(audioApi, /filenameForAudioMime\(mime\)/);
  assert.match(audioApi, /scheduleMomentTranscript\(momentId\)/);
  assert.doesNotMatch(audioApi, /await scheduleMomentTranscript/);
});
