import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

async function readSource(path) {
  return readFile(resolve(root, path), "utf8");
}

test("family bench is a private workshop table for raw Capture dumps", async () => {
  const [bench, benchPhoto, audioPlayer, family, unlock, capture, robots, layout] = await Promise.all([
    readSource("app/family/bench/page.tsx"),
    readSource("app/family/bench/bench-photo.tsx"),
    readSource("app/family/bench/bench-audio.tsx"),
    readSource("app/family/page.tsx"),
    readSource("app/family/family-unlock-panel.tsx"),
    readSource("app/family/capture/page.tsx"),
    readSource("app/robots.ts"),
    readSource("app/family/layout.tsx"),
  ]);

  assert.match(bench, /工作台 \/ Bench/);
  assert.equal((bench.match(/剛收下的，還沒整理。旅行和咖啡都還沒進。/g) ?? []).length, 1);
  assert.doesNotMatch(bench, /setMessage\([^)]*剛收下的，還沒整理/);
  assert.match(bench, /還沒有收下的。/);
  assert.match(bench, /href="\/family\/capture"/);
  assert.match(bench, /去 Capture 拍一張/);
  assert.match(bench, /fetch\("\/api\/moments"/);
  assert.match(bench, /MOMENTS_MS = 30000/);
  assert.match(bench, /SESSION_MS = 5000/);
  assert.match(bench, /sortMomentsNewestFirst/);
  assert.match(bench, /BenchPhotoThumb/);
  assert.doesNotMatch(bench, /drive-warehouse/);
  assert.match(benchPhoto, /momentPhotoPlayUrl/);
  assert.match(benchPhoto, /variant: "thumb"/);
  assert.match(benchPhoto, /fileId/);
  assert.match(benchPhoto, /THUMB_CONCURRENCY = 2/);
  assert.match(benchPhoto, /createObjectURL/);
  assert.match(benchPhoto, /isMomentVideo/);
  assert.match(benchPhoto, /播放影片/);
  assert.match(benchPhoto, /<video/);
  assert.doesNotMatch(benchPhoto, /drive-warehouse/);
  assert.doesNotMatch(bench, /加视频/);
  assert.doesNotMatch(bench, /BenchVideo/);
  assert.match(bench, /這筆還沒有照片或影片/);
  assert.match(bench, /originalAudioUrl/);
  assert.match(bench, /moment\.transcript/);
  assert.match(bench, /SpokenLine/);
  assert.match(bench, /updateMomentTranscript/);
  assert.match(bench, /spokenDrafts\[moment\.id\] \?\? spoken/);
  assert.match(bench, /TRANSCRIPT_POLL_MS = 4000/);
  assert.match(bench, /fillSpokenText/);
  assert.match(bench, /\/api\/moments\/transcript/);
  assert.match(bench, /void fillSpokenText/);
  assert.doesNotMatch(bench, /轉寫中/);
  assert.doesNotMatch(bench, /spinner/i);
  assert.match(bench, /BenchAudio/);
  assert.match(bench, /<BenchAudio momentId=\{moment\.id\} \/>/);
  assert.doesNotMatch(bench, /<audio/);
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

  assert.match(audioPlayer, /UNPLAYABLE_MOMENT_AUDIO_COPY/);
  assert.match(audioPlayer, /createObjectURL/);
  assert.match(audioPlayer, /momentAudioPlayUrl/);
  assert.match(audioPlayer, /MomentAudioPlayer/);
  assert.doesNotMatch(audioPlayer, /src=\{src\}/);
  assert.doesNotMatch(audioPlayer, /\scontrols\s/);

  assert.match(family, /入口/);
  assert.match(family, />\s*Capture\s*</);
  assert.match(family, />\s*Write\s*</);
  assert.match(family, /href="\/family\/capture"/);
  assert.match(family, /href="\/trips\/write"/);
  assert.equal((family.match(/工作台/g) ?? []).length, 1);
  assert.equal((family.match(/剛收下的，還沒整理。旅行和咖啡都還沒進。/g) ?? []).length, 1);
  assert.match(family, /href="\/family\/bench"/);
  assert.match(family, /編輯/);
  assert.match(family, /旅行遊記/);
  assert.match(family, /咖啡記憶/);
  assert.doesNotMatch(family, /去工作台看看/);
  assert.doesNotMatch(family, /Sit and write/);
  assert.doesNotMatch(family, /橱窗/);
  assert.doesNotMatch(family, /JDB Capture/);

  const entryIndex = family.indexOf(">入口<");
  const benchDoorIndex = family.indexOf(">工作台<");
  const editIndex = family.indexOf(">編輯<");
  const captureIndex = family.indexOf('href="/family/capture"');
  const writeIndex = family.indexOf('href="/trips/write"');
  assert.ok(entryIndex !== -1 && benchDoorIndex !== -1 && editIndex !== -1);
  assert.ok(entryIndex < benchDoorIndex && benchDoorIndex < editIndex);
  assert.ok(captureIndex !== -1 && writeIndex !== -1);
  assert.ok(captureIndex < benchDoorIndex && writeIndex < benchDoorIndex);
  const tripDoorIndex = family.indexOf('href="/family/trip"');
  assert.ok(tripDoorIndex !== -1 && tripDoorIndex < benchDoorIndex);
  assert.match(family, />行程</);

  assert.doesNotMatch(unlock, />\s*工作台\s*</);
  assert.doesNotMatch(unlock, /href="\/family\/bench"/);
  assert.doesNotMatch(unlock, /href="\/family\/capture"/);
  assert.match(unlock, /id="family-pin"/);
  assert.match(unlock, /開啟家庭入口/);

  assert.match(capture, /去工作台看看/);
  assert.match(capture, /\/family\/bench\?moment=/);
  assert.match(capture, /已存成 Moment。可再拍一張補上。/);
  assert.match(capture, /setSavedMomentId\(saved.keptMomentId\)/);
  assert.doesNotMatch(capture, /橱窗/);

  assert.match(robots, /\/family\/bench/);
  assert.match(layout, /data-surface="family"/);
});

test("family bench does not file dumps into coffee or public Lapland", async () => {
  const [bench, benchPhoto, audioPlayer, audioLib, coffeePage, coffeeApi, laplandPage] = await Promise.all([
    readSource("app/family/bench/page.tsx"),
    readSource("app/family/bench/bench-photo.tsx"),
    readSource("app/family/bench/bench-audio.tsx"),
    readSource("lib/moment-audio.ts"),
    readSource("app/coffee/page.tsx"),
    readSource("app/api/coffee/content/route.ts"),
    readSource("app/trips/[slug]/page.tsx"),
  ]);

  assert.doesNotMatch(bench, /readCoffeeContent/);
  assert.doesNotMatch(bench, /writeCoffeeContent/);
  assert.doesNotMatch(benchPhoto, /readCoffeeContent/);
  assert.doesNotMatch(benchPhoto, /trip_lapland_2020/);
  assert.match(audioLib, /這段聲音還不能播/);
  assert.match(audioPlayer, /UNPLAYABLE_MOMENT_AUDIO_COPY/);
  assert.doesNotMatch(coffeePage, /\/api\/moments/);
  assert.doesNotMatch(coffeePage, /moment-store/);
  assert.doesNotMatch(coffeeApi, /moment-store/);
  assert.doesNotMatch(coffeeApi, /TravelMoment/);
  assert.doesNotMatch(laplandPage, /family\/bench/);
  assert.doesNotMatch(laplandPage, /moment-store/);
});
