import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("family bench is a private workshop table for raw Capture dumps", async () => {
  const [bench, family, unlock, capture, robots] = await Promise.all([
    readSource("app/family/bench/page.tsx"),
    readSource("app/family/page.tsx"),
    readSource("app/family/family-unlock-panel.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/robots.ts"),
  ]);

  assert.match(bench, /工作台 \/ Bench/);
  assert.match(bench, /剛收下的，還沒整理。旅行和咖啡都還沒進。/);
  assert.match(bench, /還沒有收下的。/);
  assert.match(bench, /href="\/family\/capture"/);
  assert.match(bench, /去 Capture 拍一張/);
  assert.match(bench, /fetch\("\/api\/moments"/);
  assert.match(bench, /sortMomentsNewestFirst/);
  assert.match(bench, /photo\.storageKey/);
  assert.match(bench, /originalAudioUrl/);
  assert.match(bench, /<audio/);
  assert.match(bench, /get\("moment"\)/);
  assert.match(bench, /resolveFamilySession/);
  assert.match(bench, /FAMILY_ADMIN_SESSION_KEY/);
  assert.match(bench, /router\.replace\("\/family"\)/);
  assert.doesNotMatch(bench, /type="password"/);
  assert.doesNotMatch(bench, /id="family-pin"/);
  assert.doesNotMatch(bench, /橱窗/);
  assert.doesNotMatch(bench, /JDB Capture/);
  assert.doesNotMatch(bench, /BookingBand/);
  assert.doesNotMatch(bench, /travelpayouts/i);
  assert.doesNotMatch(bench, /emrldtp/);
  assert.doesNotMatch(bench, /htmlFor="people"/);
  assert.doesNotMatch(bench, /\/api\/coffee/);
  assert.doesNotMatch(bench, /\/api\/trips/);

  assert.match(family, /工作台/);
  assert.match(family, /href="\/family\/bench"/);
  assert.match(family, /去工作台看看/);
  assert.match(family, /剛收下的，還沒整理。旅行和咖啡都還沒進。/);
  assert.match(family, /旅行遊記/);
  assert.match(family, /咖啡記憶/);
  assert.doesNotMatch(family, /橱窗/);
  assert.doesNotMatch(family, /JDB Capture/);

  assert.match(unlock, /href="\/family\/bench"/);
  assert.match(unlock, /unlock\("\/family\/bench"\)/);
  assert.match(unlock, />\s*工作台\s*</);
  assert.match(unlock, /href="\/family\/capture"/);
  assert.match(unlock, />\s*Capture\s*</);

  assert.match(capture, /去工作台看看/);
  assert.match(capture, /\/family\/bench\?moment=/);
  assert.match(capture, /已存成 Moment。可再拍一張補上。/);
  assert.match(capture, /setSavedMomentId\(keptMomentId\)/);
  assert.doesNotMatch(capture, /橱窗/);

  assert.match(robots, /\/family\/bench/);
});

test("family bench does not file dumps into coffee or public Lapland", async () => {
  const [bench, coffeePage, coffeeApi, laplandPage] = await Promise.all([
    readSource("app/family/bench/page.tsx"),
    readSource("app/coffee/page.tsx"),
    readSource("app/api/coffee/content/route.ts"),
    readSource("app/trips/[slug]/page.tsx"),
  ]);

  assert.doesNotMatch(bench, /readCoffeeContent/);
  assert.doesNotMatch(bench, /writeCoffeeContent/);
  assert.doesNotMatch(coffeePage, /\/api\/moments/);
  assert.doesNotMatch(coffeePage, /moment-store/);
  assert.doesNotMatch(coffeeApi, /moment-store/);
  assert.doesNotMatch(coffeeApi, /TravelMoment/);
  assert.doesNotMatch(laplandPage, /family\/bench/);
  assert.doesNotMatch(laplandPage, /moment-store/);
});
