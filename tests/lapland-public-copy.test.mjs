import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  GO_THERE_HREF,
  GO_THERE_LABEL,
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
  journalCostChipLabel,
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

test("Lapland journal costs stay the 2020 recorded amounts", async () => {
  const seed = await readFile(resolve(root, "lib/trips.ts"), "utf8");

  assert.match(seed, /totalCost: \{ amount: 4280, currency: "EUR" \}/);
  assert.match(seed, /category: "flight"/);
  assert.match(seed, /amount: 1560/);
  assert.match(seed, /category: "hotel"/);
  assert.match(seed, /amount: 1720/);
  assert.doesNotMatch(seed, /amount: 4281/);
});

test("public trip cost UI labels journal records and keeps BookingBand", async () => {
  const [page, spend, booking] = await Promise.all([
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "components/journal-spend.tsx"), "utf8"),
    readFile(resolve(root, "components/booking-band.tsx"), "utf8"),
  ]);

  assert.match(page, /journalCostChipLabel\(trip\.startDate\)/);
  assert.doesNotMatch(page, /\["Cost", formatMoney\(trip\.totalCost\)/);
  assert.match(page, /<JournalCostHeroNote hasCost=\{Boolean\(trip\.totalCost\)\} slug=\{trip\.slug\} \/>/);
  assert.match(page, /<JournalSpendPanel costs=\{trip\.costs\} slug=\{trip\.slug\} startDate=\{trip\.startDate\} totalCost=\{trip\.totalCost\} \/>/);
  assert.match(page, /<BookingBand destination=\{laplandBooking\} \/>/);
  assert.doesNotMatch(page, /Writing guide/);
  assert.doesNotMatch(page, /Unlock editor/);
  assert.doesNotMatch(page, /Edit trip/);
  assert.doesNotMatch(page, /\/family\/capture/);

  assert.match(spend, /data-journal-spend/);
  assert.match(spend, /data-lapland-cost-2026/);
  assert.match(spend, /journalLineRecordLabel\(cost\.paidAt\)/);
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
  assert.equal(journalCostChipLabel("2020-01-18"), "2020 遊記 / Journal");
  assert.equal(journalSpendTitle("2020-01-18"), "2020 遊記花費 / Tracked spend");
  assert.equal(journalLineRecordLabel("2020-01-18"), "2020 遊記記錄 / Journal record");
  assert.equal(LAPLAND_JOURNAL_COST_ZH, "2020 年該次行程，遊記記錄，約兩人、約一週。不是今日報價。");
  assert.equal(
    LAPLAND_JOURNAL_COST_EN,
    "2020 that trip, recorded in the journal, about 2 people and about one week. Not today's price.",
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
  assert.equal(LAPLAND_COST_GO_THERE_ZH, "查今日航班與住宿。");
  assert.equal(LAPLAND_COST_GO_THERE_EN, "for today's flight/hotel quote.");
  assert.equal(JOURNAL_COST_GENERIC_ZH, "遊記裡記下的花費，不是今日報價。");
  assert.equal(JOURNAL_COST_GENERIC_EN, "Recorded in the journal, not a live quote.");

  const heroCopy = `${LAPLAND_JOURNAL_COST_ZH} ${LAPLAND_JOURNAL_COST_EN} ${LAPLAND_COST_HERO_2026_ZH} ${LAPLAND_COST_HERO_2026_EN}`;
  const asideCopy = `${LAPLAND_COST_ASIDE_2026_ZH} ${LAPLAND_COST_ASIDE_2026_EN}`;
  assert.equal(journalCostCopyHasPublicUrl(heroCopy), false);
  assert.equal(journalCostCopyHasPublicUrl(asideCopy), false);
  assert.doesNotMatch(heroCopy, /expedia\.com|ratepunk\.com|kissandfly/i);
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
  assert.match(store, /CONTENT_SCHEMA_VERSION = 10/);
  assert.match(store, /savedSchemaVersion < 10 && item\.id === LAPLAND_WINTER_VILLAGE_PHOTO_ID/);
  assert.match(store, /photo\.id === LAPLAND_WINTER_VILLAGE_PHOTO_ID && photo\.caption !== LAPLAND_WINTER_VILLAGE_CAPTION/);
  assert.match(page, /alt=\{photo\.caption \?\? photo\.originalFilename\}/);
  assert.match(page, /alt=\{coverPhoto\.caption \?\? trip\.title\}/);
  assert.match(page, /\{photo\.caption \?\? photo\.originalFilename\}/);
  assert.doesNotMatch(page, /Unlock editor/);
  assert.doesNotMatch(page, /Edit trip/);
});
