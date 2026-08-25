import { LAPLAND_TRIP_SLUG } from "@/lib/travelpayouts";

export function journalYearFromDate(date: string): string {
  const year = date.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : "journal";
}

export function journalCostChipLabel(startDate: string): string {
  return `${journalYearFromDate(startDate)} 遊記 / Journal`;
}

export function journalSpendTitle(startDate: string): string {
  return `${journalYearFromDate(startDate)} 遊記花費 / Tracked spend`;
}

export function journalLineRecordLabel(paidAt: string): string {
  return `${journalYearFromDate(paidAt)} 遊記記錄 / Journal record`;
}

export const JOURNAL_COST_GENERIC_ZH = "遊記裡記下的花費，不是今日報價。";
export const JOURNAL_COST_GENERIC_EN = "Recorded in the journal, not a live quote.";

export const LAPLAND_JOURNAL_COST_ZH = "2020 年該次行程，遊記記錄，約兩人、約一週。不是今日報價。";
export const LAPLAND_JOURNAL_COST_EN =
  "2020 that trip, recorded in the journal, about 2 people and about one week. Not today's price.";

export const LAPLAND_COST_HERO_2026_ZH =
  "2026 年 8 月參考：香港往返羅瓦涅米（HKG–RVN）來回機票常見約每人 HK$6,600–9,000。聖誕老人村小屋公開價約每晚 €250，一週約 €1,750，與 2020 住宿記錄同量級。價格波動很大。";
export const LAPLAND_COST_HERO_2026_EN =
  "August 2026 reference: HKG–RVN round-trip often about HK$6,600–9,000 per person. Santa Claus Village cabins listed around €250/night; a week in one cottage is then about €1,750 — same ballpark as the 2020 hotel line. Prices move a lot.";

export const LAPLAND_COST_ASIDE_2026_ZH =
  "2026 年 8 月參考，不是精確報價。Expedia 香港近七日曾列出來回約 HK$6,642 起；RatePunk 典型區間約 US$721–1,054，中位約 US$873（資料更新 2026 年 7 月 26 日）；Kissandfly 曾見約 US$758 起。Santa Claus Holiday Village Classic Cottage 公開價約每晚 €250；一間小屋住一週約 €1,750，與 2020 年住宿記錄同量級。價格波動很大。";
export const LAPLAND_COST_ASIDE_2026_EN =
  "August 2026 reference, not an exact quote. Expedia Hong Kong listed round-trips from about HK$6,642 in the past 7 days; RatePunk typical range about US$721–1,054, median ~US$873, data updated 26 Jul 2026. Kissandfly showed tickets from about US$758. Santa Claus Holiday Village Classic Cottage listed about €250/night. A week in one cottage is then about €1,750 — same ballpark as the 2020 hotel line. Prices move a lot.";

export const LAPLAND_COST_GO_THERE_ZH = "查今日航班與住宿。";
export const LAPLAND_COST_GO_THERE_EN = "for today's flight/hotel quote.";

export const GO_THERE_HREF = "#go-there";
export const GO_THERE_LABEL = "出發 / Go there";

export function isLaplandJournalSlug(slug: string): boolean {
  return slug === LAPLAND_TRIP_SLUG;
}

export function journalCostCopyHasPublicUrl(text: string): boolean {
  return /https?:\/\//i.test(text);
}
