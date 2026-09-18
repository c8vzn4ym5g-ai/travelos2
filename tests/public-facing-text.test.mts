import assert from "node:assert/strict";
import test from "node:test";
import { hidePublicTimestamps } from "../lib/public-facing-text.ts";

test("public blurbs drop calendar stamps without touching the source sentence", () => {
  const kyushu = "8/30–9/6 Serena 自駕。天神先住 Solaria 一晚起程。";
  const kyoto = "京都銀閣寺：北斗石、洗月泉、苔庭紅葉與山門。2022-11-17，愛慕虛榮團。";
  assert.equal(hidePublicTimestamps(kyushu), "Serena 自駕。天神先住 Solaria 一晚起程。");
  assert.equal(hidePublicTimestamps(kyoto), "京都銀閣寺：北斗石、洗月泉、苔庭紅葉與山門。愛慕虛榮團。");
  assert.equal(kyushu.startsWith("8/30"), true);
});
