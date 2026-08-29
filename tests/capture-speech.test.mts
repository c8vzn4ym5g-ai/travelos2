import assert from "node:assert/strict";
import test from "node:test";
import {
  cantoneseSpeechLang,
  CAPTURE_SPEECH_LANG_KEY,
  isCantoneseSpeechLang,
  pickAcceptedSpeechLang,
  readStoredCaptureSpeechLang,
  recognitionLangFor,
  writeStoredCaptureSpeechLang,
} from "../lib/capture-speech.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const store = { ...initial };
  return {
    getItem(key: string) {
      return store[key] ?? null;
    },
    setItem(key: string, value: string) {
      store[key] = value;
    },
    store,
  };
}

function fakeRecognition(behavior: "keep" | "drop-yue" | "normalize-hk" = "keep") {
  return class {
    #lang = "";

    set lang(value: string) {
      if (behavior === "drop-yue" && value.toLowerCase().startsWith("yue")) {
        return;
      }
      if (behavior === "normalize-hk" && value.toLowerCase() === "zh-hk") {
        this.#lang = "zh-HK";
        return;
      }
      this.#lang = value;
    }

    get lang() {
      return this.#lang;
    }
  };
}

test("speech lang defaults to 国 / zh-TW and remembers the last chip", () => {
  const storage = memoryStorage();
  assert.equal(readStoredCaptureSpeechLang(storage), "cmn");
  writeStoredCaptureSpeechLang("yue", storage);
  assert.equal(storage.store[CAPTURE_SPEECH_LANG_KEY], "yue");
  assert.equal(readStoredCaptureSpeechLang(storage), "yue");
  writeStoredCaptureSpeechLang("en", storage);
  assert.equal(readStoredCaptureSpeechLang(storage), "en");
});

test("粤 sends a Cantonese tag, never zh-TW", () => {
  assert.equal(recognitionLangFor("cmn"), "zh-TW");
  assert.equal(recognitionLangFor("en"), "en-US");
  assert.equal(recognitionLangFor("yue"), "zh-HK");
  assert.equal(cantoneseSpeechLang(fakeRecognition("keep")), "zh-HK");
  assert.equal(cantoneseSpeechLang(fakeRecognition("normalize-hk")), "zh-HK");
  assert.equal(pickAcceptedSpeechLang(["yue-Hant-HK", "zh-HK"], fakeRecognition("keep")), "yue-Hant-HK");
  assert.equal(pickAcceptedSpeechLang(["yue-Hant-HK", "zh-HK"], fakeRecognition("drop-yue")), "zh-HK");
  assert.equal(isCantoneseSpeechLang("zh-HK"), true);
  assert.equal(isCantoneseSpeechLang("yue-Hant-HK"), true);
  assert.equal(isCantoneseSpeechLang("zh-TW"), false);
});
