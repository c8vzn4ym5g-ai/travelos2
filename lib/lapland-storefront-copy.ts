import { LAPLAND_TRIP_SLUG } from "@/lib/travelpayouts";

export const LAPLAND_STOREFRONT_KICKER = "為何去 / Why go";

export const LAPLAND_STOREFRONT_TITLE = "北極圈上的冬日小鎮 / A winter town on the Arctic Circle";

export const LAPLAND_STOREFRONT_ZH =
  "芬蘭拉普蘭，羅瓦涅米，一月中冬。聖誕老人村就在北極圈上：積雪屋頂與木屋，白天安靜，入夜亮燈。從香港經赫爾辛基飛入。雪橇、雪屋與雪地營火都在同一座冬城裡。";

export const LAPLAND_STOREFRONT_EN =
  "Finnish Lapland, Rovaniemi, midwinter January. Santa Claus Village sits on the Arctic Circle: snowed roofs and timber houses, quiet by day, lit after dark. Fly from Hong Kong via Helsinki. Sledding, a snow cabin, and a campfire in the snow are all in the same winter town.";

export function isLaplandStorefrontSlug(slug: string): boolean {
  return slug === LAPLAND_TRIP_SLUG;
}

export function storefrontCopyLooksInvented(text: string): boolean {
  return (
    /https?:\/\//i.test(text) ||
    /tripadvisor|google review|\bstars?\b|visitors a year|million tourists/i.test(text) ||
    /€\s?\d|HK\$\s?\d|US\$\s?\d|\b\d+\/5\b/.test(text)
  );
}
