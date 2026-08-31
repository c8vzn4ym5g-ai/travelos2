import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { isAdminPinValid } from "../lib/family-pin.ts";
import {
  cleanSpokenTranslation,
  handleTalkTranscribe,
  handleTalkTranslate,
  m2mLangNames,
  pickSpeechVoice,
  recognitionLangForTalk,
  spokenTranslateMessages,
  talkChineseRecognitionLang,
  talkSourceLang,
  talkTargetLang,
  TALK_M2M,
  TALK_SPOKEN_LLM,
  TALK_WHISPER,
  TALK_WHISPER_TURBO,
  transcribeTalkAudio,
  translateTalkText,
  type FamilyTalkAi,
} from "../lib/family-talk.ts";

const root = resolve(import.meta.dirname, "..");

async function readSource(path: string) {
  return readFile(resolve(root, path), "utf8");
}

function withPinEnv(values: { pin?: string; required?: string }, run: () => Promise<void> | void) {
  const previousPin = process.env.TRAVELOS_ADMIN_PIN;
  const previousRequired = process.env.TRAVELOS_REQUIRE_FAMILY_PIN;

  if (values.pin === undefined) {
    delete process.env.TRAVELOS_ADMIN_PIN;
  } else {
    process.env.TRAVELOS_ADMIN_PIN = values.pin;
  }

  if (values.required === undefined) {
    delete process.env.TRAVELOS_REQUIRE_FAMILY_PIN;
  } else {
    process.env.TRAVELOS_REQUIRE_FAMILY_PIN = values.required;
  }

  return Promise.resolve()
    .then(run)
    .finally(() => {
      if (previousPin === undefined) {
        delete process.env.TRAVELOS_ADMIN_PIN;
      } else {
        process.env.TRAVELOS_ADMIN_PIN = previousPin;
      }
      if (previousRequired === undefined) {
        delete process.env.TRAVELOS_REQUIRE_FAMILY_PIN;
      } else {
        process.env.TRAVELOS_REQUIRE_FAMILY_PIN = previousRequired;
      }
    });
}

test("talk modes keep zh→ja and ja→zh, never English", () => {
  assert.equal(talkSourceLang("zh-to-ja"), "zh");
  assert.equal(talkTargetLang("zh-to-ja"), "ja");
  assert.equal(talkSourceLang("ja-to-zh"), "ja");
  assert.equal(talkTargetLang("ja-to-zh"), "zh");
  assert.equal(recognitionLangForTalk("ja-to-zh"), "ja-JP");
  assert.equal(talkChineseRecognitionLang(), "zh-TW");
  assert.deepEqual(m2mLangNames("zh"), ["chinese", "zh"]);
  assert.deepEqual(m2mLangNames("ja"), ["japanese", "ja"]);
});

test("spoken translation stays short and strips literary wrappers", () => {
  assert.equal(cleanSpokenTranslation("「すみません」"), "すみません");
  assert.equal(cleanSpokenTranslation("譯文：請給我菜單\n第二行"), "請給我菜單");
  const prompt = spokenTranslateMessages("請給我看菜單", "zh", "ja");
  assert.match(prompt.messages[0]?.content ?? "", /只輸出譯文/);
  assert.match(prompt.messages[1]?.content ?? "", /中文翻成日文/);
  assert.doesNotMatch(JSON.stringify(prompt), /English|english/);
});

test("Japanese speech prefers Kyoko or O-ren when present", () => {
  const voice = pickSpeechVoice(
    [
      { lang: "ja-JP", name: "Google 日本語" },
      { lang: "ja-JP", name: "Kyoko" },
      { lang: "zh-TW", name: "Mei-Jia" },
    ],
    "ja",
  );
  assert.equal(voice?.name, "Kyoko");

  const oren = pickSpeechVoice(
    [
      { lang: "ja-JP", name: "O-ren" },
      { lang: "ja-JP", name: "Google 日本語" },
    ],
    "ja",
  );
  assert.equal(oren?.name, "O-ren");

  const chinese = pickSpeechVoice(
    [
      { lang: "zh-CN", name: "Tingting" },
      { lang: "zh-TW", name: "Mei-Jia" },
    ],
    "zh",
  );
  assert.equal(chinese?.name, "Mei-Jia");
});

test("Workers AI transcribes then falls back across whisper models", async () => {
  const calls: string[] = [];
  const ai: FamilyTalkAi = {
    async run(model) {
      calls.push(model);
      if (model === TALK_WHISPER_TURBO) {
        throw new Error("turbo down");
      }
      if (model === TALK_WHISPER) {
        return { text: "すみません" };
      }
      return {};
    },
  };

  const text = await transcribeTalkAudio(ai, new Uint8Array(64).fill(7), "ja");
  assert.equal(text, "すみません");
  assert.deepEqual(calls, [TALK_WHISPER_TURBO, TALK_WHISPER]);
});

test("spoken LLM translation falls back to m2m100", async () => {
  const calls: string[] = [];
  const ai: FamilyTalkAi = {
    async run(model, inputs) {
      calls.push(model);
      if (model === TALK_SPOKEN_LLM) {
        return { response: "" };
      }
      if (model === TALK_M2M) {
        assert.equal(typeof inputs.text, "string");
        return { translated_text: "メニューを見せてください" };
      }
      return {};
    },
  };

  const text = await translateTalkText(ai, "請給我看菜單", "zh", "ja");
  assert.equal(text, "メニューを見せてください");
  assert.equal(calls[0], TALK_SPOKEN_LLM);
  assert.equal(calls.includes(TALK_M2M), true);
});

test("talk APIs work with PIN off and still lock when the flag is on", async () => {
  const ai: FamilyTalkAi = {
    async run(model) {
      if (String(model).includes("whisper")) {
        return { text: "水をお願いします" };
      }
      return { response: "請給我水" };
    },
  };

  await withPinEnv({ pin: "secret", required: undefined }, async () => {
    assert.equal(isAdminPinValid(null), true);
    const translate = await handleTalkTranslate(
      new Request("http://travelos.local/api/family/talk/translate", {
        body: JSON.stringify({ text: "水をお願いします", from: "ja", to: "zh" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      ai,
    );
    assert.equal(translate.status, 200);
    assert.deepEqual(await translate.json(), { source: "水をお願いします", translated: "請給我水" });

    const form = new FormData();
    form.set("lang", "ja");
    form.set("file", new File([new Uint8Array(48).fill(3)], "talk.m4a", { type: "audio/mp4" }));
    const transcribe = await handleTalkTranscribe(
      new Request("http://travelos.local/api/family/talk/transcribe", {
        body: form,
        method: "POST",
      }),
      ai,
    );
    assert.equal(transcribe.status, 200);
    assert.deepEqual(await transcribe.json(), { text: "水をお願いします", lang: "ja" });
  });

  await withPinEnv({ pin: "family-secret", required: "1" }, async () => {
    const locked = await handleTalkTranslate(
      new Request("http://travelos.local/api/family/talk/translate", {
        body: JSON.stringify({ text: "hello", from: "zh", to: "ja" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      ai,
    );
    assert.equal(locked.status, 401);
  });
});

test("talk page is a cute family booklet door with framed back and PWA", async () => {
  const [page, css, layout, wrangler, manifest, familyHome, capture, trip, lapland] = await Promise.all([
    readSource("app/family/talk/page.tsx"),
    readSource("app/family/talk/talk.css"),
    readSource("app/family/talk/layout.tsx"),
    readSource("wrangler.jsonc"),
    readSource("public/family/talk/manifest.webmanifest"),
    readSource("app/family/page.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/family/trip/page.tsx"),
    readSource("app/trips/[slug]/page.tsx"),
  ]);

  assert.match(page, /我說中文/);
  assert.match(page, /對方說日文/);
  assert.match(page, /再聽一次/);
  assert.match(page, /speechSynthesis/);
  assert.match(page, /webkitSpeechRecognition|startTalkSpeech/);
  assert.match(page, /MediaRecorder/);
  assert.match(page, /\/api\/family\/talk\/transcribe/);
  assert.match(page, /\/api\/family\/talk\/translate/);
  assert.match(page, /wakeLock/);
  assert.match(page, /className="talk-back"/);
  assert.doesNotMatch(page, /className="fam-back/);
  assert.doesNotMatch(page, /English|en-US|auto-detect/);
  assert.match(css, /#f0f6e4/);
  assert.match(css, /\.talk-back:active/);
  assert.match(css, /box-shadow: 0 3px 0/);
  assert.match(layout, /apple-touch-icon\.png/);
  assert.match(layout, /manifest\.webmanifest/);
  assert.match(layout, /themeColor: "#F0F6E4"/);
  assert.match(manifest, /"start_url": "\/family\/talk"/);
  assert.match(manifest, /家庭說話/);
  assert.match(wrangler, /"binding": "AI"/);
  assert.match(familyHome, /href="\/family\/talk"/);
  assert.match(familyHome, />說說</);
  assert.doesNotMatch(capture, /family\/talk/);
  assert.doesNotMatch(trip, /family\/talk/);
  assert.doesNotMatch(lapland, /family\/talk/);
  assert.doesNotMatch(capture, /createWorkQueue/);
});
