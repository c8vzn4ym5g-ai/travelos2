import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("public trip page has no writer chrome", async () => {
  const page = await readFile(resolve(root, "app/(public)/trips/[slug]/page.tsx"), "utf8");

  assert.doesNotMatch(page, /Writing guide/);
  assert.doesNotMatch(page, /Visitor scan/);
  assert.doesNotMatch(page, /Before you read/);
  assert.doesNotMatch(page, /This page is shaped for readers first/);
  assert.doesNotMatch(page, /Support text stays short/);
  assert.doesNotMatch(page, /Draft ready/);
});

test("Lapland seed copy uses the professional bilingual titles", async () => {
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");

  assert.match(seed, /laplandTitle: "拉普蘭冬日記憶"/);
  assert.match(seed, /Lapland Winter Journal/);
  assert.match(seed, /抵達北極圈 \/ Arrival at the Arctic Circle/);
  assert.match(seed, /laplandSanta: "聖誕老人村"/);
  assert.match(seed, / \/ Santa Claus Village`/);
  assert.match(seed, /laplandCampfire: "雪地營火"/);
  assert.match(seed, /Campfire in the snow/);
  assert.doesNotMatch(seed, /Arrival above the Arctic Circle/);
  assert.doesNotMatch(seed, /warmth is not an abstract word/);
  assert.doesNotMatch(seed, /restrained purity/);
});
