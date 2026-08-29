import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { afterResponse } from "../lib/after-response.ts";
import { appendSpokenText, spokenTextFromSpeechEvent } from "../lib/capture-speech.ts";
import {
  encodeWavBytes,
  filenameForAudioMime,
  formatAudioDurationLabel,
  isFragmentedMp4,
  isTrustedMomentAudioUrl,
  momentAudioPlayUrl,
  readFtypBrands,
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

test("spoken capture text accumulates without replacing the original audio", () => {
  assert.equal(appendSpokenText("", "今天咖哩好吃"), "今天咖哩好吃");
  assert.equal(appendSpokenText("今天咖哩好吃", "今天咖哩好吃"), "今天咖哩好吃");
  assert.equal(appendSpokenText("今天", "咖哩好吃"), "今天 咖哩好吃");
  assert.equal(
    spokenTextFromSpeechEvent({
      resultIndex: 0,
      results: [
        { isFinal: true, 0: { transcript: "今天" } },
        { isFinal: false, 0: { transcript: "咖哩" } },
      ],
    }),
    "今天 咖哩",
  );
});

test("iPhone fmp4 audio labeled webm is sniffed as audio/mp4", () => {
  const bytes = mp4Header();
  assert.equal(sniffAudioMime(bytes), "audio/mp4");
  assert.equal(resolveAudioMime(bytes, "video/webm"), "audio/mp4");
  assert.equal(filenameForAudioMime("audio/mp4"), "moment-audio.m4a");
  assert.equal(readFtypBrands(bytes)[0], "iso5");
  assert.equal(isFragmentedMp4(bytes), true);
  assert.equal(isFragmentedMp4(webmHeader()), false);
});

test("wav encoder writes a playable audio/wav header", () => {
  const wav = encodeWavBytes([new Float32Array([0, 0.5, -0.5, 0])], 8000);
  assert.equal(sniffAudioMime(wav), "audio/wav");
  assert.equal(filenameForAudioMime("audio/wav"), "moment-audio.wav");
  assert.equal(formatAudioDurationLabel(8), "約 8 秒");
  assert.equal(formatAudioDurationLabel(0), "這段聲音");
});

test("moment audio play URLs stay on the family origin and reject open fetch", () => {
  assert.equal(momentAudioPlayUrl("moment_1"), "/api/moments/audio?momentId=moment_1");
  assert.equal(
    isTrustedMomentAudioUrl("https://abc.public.blob.vercel-storage.com/travelos/moments/audio/x.m4a"),
    true,
  );
  assert.equal(isTrustedMomentAudioUrl("drive:1abcFileId"), true);
  assert.equal(isTrustedMomentAudioUrl("drive:"), false);
  assert.equal(isTrustedMomentAudioUrl("https://evil.example/audio.mp4"), false);
  assert.equal(isTrustedMomentAudioUrl("data:audio/mp4;base64,AAAA"), true);
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

test("afterResponse uses Next, Vercel, and Cloudflare waitUntil so transcript work survives the HTTP response", async () => {
  for (const key of [Symbol.for("@next/request-context"), Symbol.for("@vercel/request-context")]) {
    const previous = globalThis[key];
    const held = [];
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: {
        get() {
          return {
            waitUntil(promise) {
              held.push(promise);
            },
          };
        },
      },
    });

    try {
      let finished = false;
      const pending = afterResponse(async () => {
        finished = true;
      });
      assert.equal(held.length, 1);
      assert.equal(held[0], pending);
      await pending;
      assert.equal(finished, true);
    } finally {
      if (previous === undefined) {
        delete globalThis[key];
      } else {
        Object.defineProperty(globalThis, key, { configurable: true, value: previous });
      }
    }
  }

  const cloudflareKey = Symbol.for("__cloudflare-context__");
  const previousCloudflare = globalThis[cloudflareKey];
  const held = [];
  Object.defineProperty(globalThis, cloudflareKey, {
    configurable: true,
    value: {
      ctx: {
        waitUntil(promise) {
          held.push(promise);
        },
      },
    },
  });
  try {
    let finished = false;
    const pending = afterResponse(async () => {
      finished = true;
    });
    assert.equal(held.length, 1);
    assert.equal(held[0], pending);
    await pending;
    assert.equal(finished, true);
  } finally {
    if (previousCloudflare === undefined) {
      delete globalThis[cloudflareKey];
    } else {
      Object.defineProperty(globalThis, cloudflareKey, { configurable: true, value: previousCloudflare });
    }
  }
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
  const [capture, upload, audioApi, player, playback] = await Promise.all([
    readSource("app/family/capture/page.tsx"),
    readSource("lib/capture-upload.ts"),
    readSource("app/api/moments/audio/route.ts"),
    readSource("app/family/moment-audio-player.tsx"),
    readSource("lib/moment-audio-playback.ts"),
  ]);

  assert.match(capture, /preferredRecorderMime/);
  assert.match(capture, /startCaptureSpeech/);
  assert.match(capture, /sentTranscript = spokenRef\.current \|\| staged\.transcript/);
  assert.match(capture, /transcript: sentTranscript/);
  assert.match(upload, /audioData.set\("transcript"/);
  assert.match(capture, /MediaRecorder\(stream, \{ mimeType: recorderMime \}\)/);
  assert.match(capture, /preparePlayableAudio/);
  assert.match(capture, /primePlaybackAudioContext/);
  assert.match(capture, /MomentAudioPlayer/);
  assert.match(capture, /durationSeconds/);
  assert.doesNotMatch(capture, /<audio className="w-full" controls/);
  assert.match(upload, /filenameForAudioMime/);
  assert.match(upload, /resolveAudioMime/);
  assert.match(upload, /input\.blob\.slice\(0\)/);
  assert.doesNotMatch(upload, /moment-audio\.webm"\)/);
  assert.match(audioApi, /filenameForAudioMime\(mime\)/);
  assert.match(audioApi, /scheduleMomentTranscript\(momentId\)/);
  assert.match(audioApi, /formData.get\("transcript"\)/);
  assert.match(audioApi, /export async function GET/);
  assert.match(audioApi, /isTrustedMomentAudioUrl/);
  assert.match(audioApi, /getMomentById/);
  assert.match(audioApi, /Content-Type/);
  assert.doesNotMatch(audioApi, /await scheduleMomentTranscript/);
  assert.match(player, /播放/);
  assert.match(player, /UNPLAYABLE_MOMENT_AUDIO_COPY/);
  assert.match(player, /video\/mp4/);
  assert.doesNotMatch(player, /\scontrols\s/);
  const toggle = player.slice(player.indexOf("async function togglePlayback"));
  assert.doesNotMatch(toggle, /revokeObjectURL/);
  assert.doesNotMatch(player, /setAudio\(null\)/);
  assert.match(playback, /decodeToWavFile/);
  assert.match(playback, /isFragmentedMp4/);
});
