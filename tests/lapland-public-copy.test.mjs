import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  GO_THERE_HREF,
  GO_THERE_LABEL,
  JOURNAL_COST_CHIP_LABEL,
  JOURNAL_COST_GENERIC_EN,
  JOURNAL_COST_GENERIC_ZH,
  LAPLAND_COST_ASIDE_2026_EN,
  LAPLAND_COST_ASIDE_2026_ZH,
  LAPLAND_COST_GO_THERE_EN,
  LAPLAND_COST_GO_THERE_ZH,
  LAPLAND_COST_HERO_2026_EN,
  LAPLAND_COST_HERO_2026_ZH,
  LAPLAND_JOURNAL_COST_EN,
  LAPLAND_JOURNAL_COST_ZH,
  journalCostCopyHasPublicUrl,
  journalLineRecordLabel,
  journalSpendTitle,
} from "../lib/journal-cost-copy.ts";
import { LAPLAND_WINTER_VILLAGE_CAPTION } from "../lib/trips.ts";

const root = resolve(import.meta.dirname, "..");

test("public trip page has no writer chrome", async () => {
  const page = await readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8");

  assert.doesNotMatch(page, /Writing guide/);
  assert.doesNotMatch(page, /Visitor scan/);
  assert.doesNotMatch(page, /Before you read/);
  assert.doesNotMatch(page, /This page is shaped for readers first/);
  assert.doesNotMatch(page, /Support text stays short/);
  assert.doesNotMatch(page, /Draft ready/);
});

test("Lapland seed copy uses seasonal bilingual titles, not a year in the slug", async () => {
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");

  assert.match(seed, /laplandTitle: "北極圈上的十二月"/);
  assert.match(seed, /December on the Arctic Circle/);
  assert.match(seed, /slug: "finland-lapland-winter-journal"/);
  assert.doesNotMatch(seed, /slug: "finland-lapland-winter-journal-2019"/);
  assert.doesNotMatch(seed, /slug: "finland-lapland-winter-journal-2020"/);
  assert.match(seed, /北極圈 \/ Arctic Circle/);
  assert.match(seed, /聖誕窗 \/ Christmas window/);
  assert.match(seed, /4 號紅木屋 \/ Red cabin no. 4/);
  assert.match(seed, /赫爾辛基解凍 \/ Helsinki thaw/);
  assert.doesNotMatch(seed, /離開羅瓦涅米 \/ Leaving Rovaniemi/);
  assert.doesNotMatch(seed, /雪天使|snow-angel|Moomin/);
  assert.doesNotMatch(seed, /2020-01-18/);
  assert.doesNotMatch(seed, /抵達北極圈 \/ Arrival at the Arctic Circle/);
  assert.doesNotMatch(seed, /Arrival above the Arctic Circle/);
  assert.doesNotMatch(seed, /warmth is not an abstract word/);
  assert.doesNotMatch(seed, /restrained purity/);
  assert.doesNotMatch(seed, /Campfire in the snow/);
  assert.doesNotMatch(seed, /2020 年 1 月/);
  assert.doesNotMatch(seed, /January 2020/);
  assert.doesNotMatch(seed, /12 月 11 日/);
  assert.doesNotMatch(seed, /11 December/);
  assert.doesNotMatch(seed, /December 2019\./);
});

test("Lapland journal costs stay the 2020 recorded amounts", async () => {
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");

  assert.match(seed, /totalCost: \{ amount: 4280, currency: "EUR" \}/);
  assert.match(seed, /category: "flight"/);
  assert.match(seed, /amount: 1560/);
  assert.match(seed, /category: "hotel"/);
  assert.match(seed, /amount: 1720/);
  assert.match(seed, /amount: 640/);
  assert.doesNotMatch(seed, /amount: 4281/);
});

test("public trip cost UI keeps a quiet chip and collapsed cost notes", async () => {
  const [page, spend, booking] = await Promise.all([
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "components/journal-spend.tsx"), "utf8"),
    readFile(resolve(root, "components/booking-band.tsx"), "utf8"),
  ]);

  assert.match(page, /<JournalCostChip amount=\{formatMoney\(trip\.totalCost\)\} slug=\{trip\.slug\} \/>/);
  assert.doesNotMatch(page, /journalCostChipLabel/);
  assert.doesNotMatch(page, /JournalCostHeroNote/);
  assert.doesNotMatch(page, /LAPLAND_COST_HERO_2026/);
  assert.doesNotMatch(page, /HK\$6,600/);
  assert.match(page, /<JournalSpendPanel costs=\{trip\.costs\} slug=\{trip\.slug\} startDate=\{trip\.startDate\} totalCost=\{trip\.totalCost\} \/>/);
  assert.match(page, /<BookingBand destination=\{getLaplandBooking\(\)\} \/>/);
  assert.match(page, /<LaplandStorefrontGlance \/>/);
  assert.doesNotMatch(page, /Writing guide/);
  assert.doesNotMatch(page, /Unlock editor/);
  assert.doesNotMatch(page, /Edit trip/);
  assert.doesNotMatch(page, /\/family\/capture/);

  assert.match(spend, /data-journal-cost-chip/);
  assert.match(spend, /data-journal-spend/);
  assert.match(spend, /data-lapland-cost-2026/);
  assert.match(spend, /<details className="journal-cost-chip/);
  assert.match(spend, /<details className="journal-cost-notes/);
  assert.doesNotMatch(spend, /<details[^>]*\sopen/);
  assert.match(spend, /journalLineRecordLabel\(cost\.paidAt\)/);
  assert.match(spend, /JOURNAL_COST_CHIP_LABEL/);
  assert.match(spend, /LAPLAND_JOURNAL_COST_ZH/);
  assert.match(spend, /LAPLAND_COST_HERO_2026_ZH/);
  assert.match(spend, /LAPLAND_COST_ASIDE_2026_ZH/);
  assert.match(spend, /href=\{GO_THERE_HREF\}/);
  assert.doesNotMatch(spend, /https?:\/\//);
  assert.doesNotMatch(spend, /widgetId/);
  assert.doesNotMatch(spend, /Edit /);

  assert.match(booking, /id="go-there"/);
  assert.match(booking, /出發 \/ Go there/);
  assert.doesNotMatch(booking, /widgetId/);
});

test("Lapland 2020 and August 2026 cost copy is bilingual and not a live quote", () => {
  assert.equal(JOURNAL_COST_CHIP_LABEL, "Cost");
  assert.equal(journalSpendTitle("2019-12-11"), "2019 遊記花費 / Tracked spend");
  assert.equal(journalLineRecordLabel("2019-12-11"), "2019 遊記記錄 / Journal record");
  assert.equal(LAPLAND_JOURNAL_COST_ZH, "2019 年 12 月該次行程。金額來自後來標成 2020 的遊記記錄，約兩人、約五日。不是今日報價。");
  assert.equal(
    LAPLAND_JOURNAL_COST_EN,
    "December 2019 that trip. Amounts come from a later journal write-up labelled 2020, about 2 people and about five days. Not today's price.",
  );
  assert.match(LAPLAND_COST_HERO_2026_ZH, /2026 年 8 月參考/);
  assert.match(LAPLAND_COST_HERO_2026_ZH, /HK\$6,600–9,000/);
  assert.match(LAPLAND_COST_HERO_2026_ZH, /€250/);
  assert.match(LAPLAND_COST_HERO_2026_ZH, /€1,750/);
  assert.match(LAPLAND_COST_HERO_2026_EN, /August 2026 reference/);
  assert.match(LAPLAND_COST_HERO_2026_EN, /HK\$6,600–9,000 per person/);
  assert.match(LAPLAND_COST_ASIDE_2026_ZH, /Expedia 香港近七日曾列出來回約 HK\$6,642 起/);
  assert.match(LAPLAND_COST_ASIDE_2026_ZH, /RatePunk 典型區間約 US\$721–1,054，中位約 US\$873/);
  assert.match(LAPLAND_COST_ASIDE_2026_ZH, /2026 年 7 月 26 日/);
  assert.match(LAPLAND_COST_ASIDE_2026_ZH, /Kissandfly 曾見約 US\$758 起/);
  assert.match(LAPLAND_COST_ASIDE_2026_EN, /Santa Claus Holiday Village Classic Cottage listed about €250\/night/);
  assert.match(LAPLAND_COST_ASIDE_2026_EN, /same ballpark as the 2020 hotel line/);
  assert.equal(GO_THERE_HREF, "#go-there");
  assert.equal(GO_THERE_LABEL, "出發 / Go there");
  assert.equal(LAPLAND_COST_GO_THERE_ZH, "不是今日報價，點 出發 查即時機票。");
  assert.equal(LAPLAND_COST_GO_THERE_EN, "Not today's quote, tap 出發 for live fares.");
  assert.equal(JOURNAL_COST_GENERIC_ZH, "遊記裡記下的花費，不是今日報價。");
  assert.equal(JOURNAL_COST_GENERIC_EN, "Recorded in the journal, not a live quote.");

  const footnoteCopy = `${LAPLAND_JOURNAL_COST_ZH} ${LAPLAND_JOURNAL_COST_EN} ${LAPLAND_COST_HERO_2026_ZH} ${LAPLAND_COST_HERO_2026_EN} ${LAPLAND_COST_GO_THERE_ZH} ${LAPLAND_COST_GO_THERE_EN}`;
  const asideCopy = `${LAPLAND_COST_ASIDE_2026_ZH} ${LAPLAND_COST_ASIDE_2026_EN}`;
  assert.equal(journalCostCopyHasPublicUrl(footnoteCopy), false);
  assert.equal(journalCostCopyHasPublicUrl(asideCopy), false);
  assert.doesNotMatch(footnoteCopy, /expedia\.com|ratepunk\.com|kissandfly/i);
});

test("December 2019 locked stills are local public assets, not dump or moment hotlinks", async () => {
  const { access } = await import("node:fs/promises");
  const { createHash } = await import("node:crypto");
  const { stat } = await import("node:fs/promises");
  const { LAPLAND_LOCKED_STILLS } = await import("../lib/lapland-storefront-copy.ts");
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");
  const config = await readFile(resolve(root, "next.config.ts"), "utf8");
  const copy = await readFile(resolve(root, "lib/lapland-storefront-copy.ts"), "utf8");
  const page = await readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8");

  for (const still of LAPLAND_LOCKED_STILLS) {
    const stillPath = resolve(root, "public/travelos/lapland/stills", still.filename);
    const [bytes, info] = await Promise.all([readFile(stillPath), stat(stillPath)]);
    assert.equal(info.size, still.bytes, still.filename);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), still.sha256, still.filename);
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
    assert.match(seed, new RegExp(`/travelos/lapland/stills/${still.filename.replace(".", "\\.")}`));
  }

  for (const file of ["garnish-helsinki-cathedral.jpeg", "garnish-helsinki-harbour.jpeg"]) {
    await access(resolve(root, "public/travelos/lapland", file));
    assert.match(seed, new RegExp(`/travelos/lapland/${file.replace(".", "\\.")}`));
  }

  assert.doesNotMatch(seed, /twnwgydxea5cgnyi\.public\.blob\.vercel-storage\.com/);
  assert.doesNotMatch(seed, /dump-snow-angel|santa-village-night|dump-moomin/);
  assert.doesNotMatch(seed, /場所圖，不是這次家庭照片/);
  assert.doesNotMatch(copy, /Place photograph, not from this family trip/);
  assert.doesNotMatch(copy, /不是這次家庭照片/);
  assert.match(copy, /Wikimedia Commons · public domain/);
  assert.match(copy, /Ninara · CC BY 2.0/);
  assert.match(copy, /data-photo-credits|LAPLAND_PHOTO_CREDITS/);
  assert.match(page, /data-photo-credits/);
  assert.match(config, /destination: "\/trips\/finland-lapland-winter-journal"/);
  assert.match(config, /finland-lapland-winter-journal-2020/);
  assert.match(config, /finland-lapland-winter-journal-2019/);
  assert.match(config, /permanent: true/);
  assert.doesNotMatch(copy, /2019/);
  assert.doesNotMatch(copy, /12 月 11/);
  assert.doesNotMatch(copy, /11 Dec/);
  assert.doesNotMatch(copy, /11 December/);
});

test("Lapland winter-village photo uses Sana's Christmas-card caption", async () => {
  const [seed, store, page] = await Promise.all([
    readFile(resolve(root, "lib/trips.ts"), "utf8"),
    readFile(resolve(root, "lib/editable-store.ts"), "utf8"),
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
  ]);

  assert.equal(LAPLAND_WINTER_VILLAGE_CAPTION, "記憶裡的聖誕卡 / A Christmas card from memory");
  assert.match(seed, /laplandWinterVillage: "記憶裡的聖誕卡"/);
  assert.match(seed, /LAPLAND_WINTER_VILLAGE_CAPTION/);
  assert.doesNotMatch(seed, /id: LAPLAND_WINTER_VILLAGE_PHOTO_ID/);
  assert.doesNotMatch(seed, /屋頂與雪徑/);
  assert.doesNotMatch(seed, /Roofs and snow paths/);
  assert.match(store, /CONTENT_SCHEMA_VERSION = 14/);
  assert.match(store, /rebuildLaplandPublicStory/);
  assert.match(store, /photo_lapland_garnish_/);
  assert.match(store, /savedSchemaVersion < 14 && seedTrip.id === "trip_lapland_2020"/);
  assert.match(page, /forLaplandPublicPage/);
  assert.match(page, /hideExactDate=\{isLaplandStorefrontSlug\(trip\.slug\)\}/);
  assert.match(page, /alt=\{coverPhoto\.caption \?\? trip\.title\}/);
  assert.match(page, /\{photo\.caption \?\? photo\.originalFilename\}/);
  assert.doesNotMatch(page, /Unlock editor/);
  assert.doesNotMatch(page, /Edit trip/);
});

test("Lapland public short is the exact Codex cut under Journey, not a substitute file", async () => {
  const { createHash } = await import("node:crypto");
  const { stat } = await import("node:fs/promises");
  const {
    LAPLAND_PUBLIC_CUT_BYTES,
    LAPLAND_PUBLIC_CUT_FILENAME,
    LAPLAND_PUBLIC_CUT_SHA256,
    LAPLAND_PUBLIC_CUT_SRC,
    LAPLAND_SEASON_LABEL,
  } = await import("../lib/lapland-storefront-copy.ts");
  const videoPath = resolve(root, "public/travelos/lapland", LAPLAND_PUBLIC_CUT_FILENAME);
  const [video, info, page, cut, still, more, poster] = await Promise.all([
    readFile(videoPath),
    stat(videoPath),
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "components/lapland-public-cut.tsx"), "utf8"),
    readFile(resolve(root, "components/lapland-cut-still.tsx"), "utf8"),
    readFile(resolve(root, "components/lapland-more-cut.tsx"), "utf8"),
    readFile(resolve(root, "public/travelos/maps/lapland-helsinki-poster.jpg")),
  ]);

  assert.equal(info.size, 8946351);
  assert.equal(info.size, LAPLAND_PUBLIC_CUT_BYTES);
  assert.equal(createHash("sha256").update(video).digest("hex"), LAPLAND_PUBLIC_CUT_SHA256);
  assert.equal(video.subarray(4, 8).toString("ascii"), "ftyp");
  assert.equal(LAPLAND_PUBLIC_CUT_SRC, `/travelos/lapland/${LAPLAND_PUBLIC_CUT_FILENAME}`);
  assert.match(page, /<LaplandPublicCut \/>/);
  assert.match(page, /<LaplandCutStill/);
  assert.match(page, /<LaplandMoreCut>/);
  assert.match(page, /<JourneyMap/);
  assert.ok(page.indexOf("<LaplandPublicCut") < page.indexOf("<LaplandCutStill"), "one still follows the public cut");
  assert.ok(page.indexOf("<LaplandCutStill") < page.indexOf("<LaplandMoreCut"), "extras sit behind the more tap");
  assert.ok(page.indexOf("<LaplandPublicCut") < page.indexOf("<JourneyMap"), "public cut sits before the frozen poster");
  assert.match(cut, /data-lapland-public-cut=""/);
  assert.match(cut, /LAPLAND_PUBLIC_CUT_SRC/);
  assert.match(cut, /autoPlay/);
  assert.match(cut, /muted/);
  assert.match(cut, /playsInline/);
  assert.match(cut, /controls/);
  assert.match(cut, /LAPLAND_SEASON_LABEL/);
  assert.doesNotMatch(cut, /2019-12-1[0-5]|36s|60s/);
  assert.doesNotMatch(page, /2019-12-1[0-5]/);
  assert.match(still, /data-lapland-cut-still=""/);
  assert.match(still, /object-contain/);
  assert.match(still, /photo\.storageKey/);
  assert.match(more, /data-lapland-more=""/);
  assert.match(more, /更多 \/ More/);
  assert.match(more, /min-h-11/);
  assert.doesNotMatch(more, /<details[^>]*\sopen/);
  assert.match(page, /<LaplandStorefrontGlance \/>/);
  assert.match(page, /<LaplandVisualPath photos=\{trip\.photos\} \/>/);
  assert.ok(page.indexOf("<LaplandMoreCut>") < page.indexOf("<LaplandStorefrontGlance"), "why-go copy sits behind the tap");
  assert.ok(page.indexOf("<LaplandMoreCut>") < page.indexOf("<LaplandVisualPath"), "path extras sit behind the tap");
  assert.ok(page.indexOf("<LaplandMoreCut>") < page.indexOf("<JournalCostChip"), "season and cost chips sit behind the tap");
  assert.equal(LAPLAND_SEASON_LABEL, "十二月 · 深冬 / December · midwinter");
  assert.equal(
    createHash("sha256").update(poster).digest("hex"),
    "480debd99daad4ecbd9fba70dcc2a42fe1bf82007cc13531bfe12ac42a23090a",
  );
});
