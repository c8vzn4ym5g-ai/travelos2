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

test("Lapland seed copy uses the December 2019 bilingual titles", async () => {
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");

  assert.match(seed, /laplandTitle: "北極圈上的十二月"/);
  assert.match(seed, /December on the Arctic Circle/);
  assert.match(seed, /finland-lapland-winter-journal-2019/);
  assert.match(seed, /startDate: "2019-12-11"/);
  assert.match(seed, /endDate: "2019-12-15"/);
  assert.match(seed, /北極圈 \/ Arctic Circle/);
  assert.match(seed, /4 號紅木屋 \/ Red cabin no. 4/);
  assert.match(seed, /離開羅瓦涅米 \/ Leaving Rovaniemi/);
  assert.match(seed, /赫爾辛基解凍 \/ Helsinki thaw/);
  assert.doesNotMatch(seed, /finland-lapland-winter-journal-2020/);
  assert.doesNotMatch(seed, /2020-01-18/);
  assert.doesNotMatch(seed, /抵達北極圈 \/ Arrival at the Arctic Circle/);
  assert.doesNotMatch(seed, /Arrival above the Arctic Circle/);
  assert.doesNotMatch(seed, /warmth is not an abstract word/);
  assert.doesNotMatch(seed, /restrained purity/);
  assert.doesNotMatch(seed, /Campfire in the snow/);
  assert.doesNotMatch(seed, /2020 年 1 月/);
  assert.doesNotMatch(seed, /January 2020/);
});

test("Lapland journal costs stay the 2020 recorded amounts", async () => {
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");

  assert.match(seed, /totalCost: \{ amount: 4280, currency: "EUR" \}/);
  assert.match(seed, /category: "flight"/);
  assert.match(seed, /amount: 1560/);
  assert.match(seed, /category: "hotel"/);
  assert.match(seed, /amount: 1720/);
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
  assert.match(page, /<BookingBand destination=\{laplandBooking\} \/>/);
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

test("December 2019 dump photos are local public assets, not moment hotlinks", async () => {
  const { access } = await import("node:fs/promises");
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");
  const config = await readFile(resolve(root, "next.config.ts"), "utf8");
  const copy = await readFile(resolve(root, "lib/lapland-storefront-copy.ts"), "utf8");
  const dumpFiles = [
    "dump-arctic-circle-pillars.jpeg",
    "dump-arctic-circle-sign.jpeg",
    "dump-cabin-4-snowman.jpeg",
    "dump-cabin-window.jpeg",
    "dump-finnair-tarmac.jpeg",
    "dump-helsinki-staircase.jpeg",
    "dump-post-office.jpeg",
    "garnish-helsinki-cathedral.jpeg",
    "garnish-helsinki-harbour.jpeg",
  ];

  for (const file of dumpFiles) {
    await access(resolve(root, "public/travelos/lapland", file));
    assert.match(seed, new RegExp(`/travelos/lapland/${file.replace(".", "\\.")}`));
  }

  assert.doesNotMatch(seed, /twnwgydxea5cgnyi\.public\.blob\.vercel-storage\.com/);
  assert.doesNotMatch(seed, /IMG_3665/);
  assert.match(seed, /場所圖，不是這次家庭照片/);
  assert.match(copy, /Place photograph, not from this family trip/);
  assert.match(copy, /Wikimedia Commons · Public domain/);
  assert.match(copy, /CC BY 2.0 · Ninara/);
  assert.match(config, /finland-lapland-winter-journal-2020/);
  assert.match(config, /finland-lapland-winter-journal-2019/);
  assert.match(config, /permanent: true/);
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
  assert.match(seed, /id: LAPLAND_WINTER_VILLAGE_PHOTO_ID/);
  assert.doesNotMatch(seed, /屋頂與雪徑/);
  assert.doesNotMatch(seed, /Roofs and snow paths/);
  assert.match(store, /CONTENT_SCHEMA_VERSION = 11/);
  assert.match(store, /rebuildLaplandPublicStory/);
  assert.match(store, /savedSchemaVersion < 11 && seedTrip.id === "trip_lapland_2020"/);
  assert.match(page, /alt=\{photo\.caption \?\? photo\.originalFilename\}/);
  assert.match(page, /alt=\{coverPhoto\.caption \?\? trip\.title\}/);
  assert.match(page, /\{photo\.caption \?\? photo\.originalFilename\}/);
  assert.doesNotMatch(page, /Unlock editor/);
  assert.doesNotMatch(page, /Edit trip/);
});
