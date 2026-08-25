import { isLaplandPublicSlug } from "@/lib/travelpayouts";
import type { TripDetail } from "@/lib/types";

export const LAPLAND_STOREFRONT_KICKER = "為何去 / Why go";

export const LAPLAND_STOREFRONT_TITLE = "北極圈上的冬日小鎮，然後是城市 / A winter town on the Arctic Circle, then a city";

export const LAPLAND_STOREFRONT_ZH =
  "芬蘭拉普蘭，十二月、深冬、聖誕季。聖誕老人村在北極圈上：積雪、木屋，廣場上有一條可以走過去的線。白晝大約兩三小時，日出近中午，日落在下午。然後往南到赫爾辛基，雪後是城市與設計。從香港通常經赫爾辛基轉機進羅瓦涅米。極光在十二月有機會，但不是保證。";

export const LAPLAND_STOREFRONT_EN =
  "Finnish Lapland, mid-December: deep winter, the Christmas window. Santa Claus Village sits on the Arctic Circle: snow, timber houses, and a line you can walk across in the square. Daylight lasts about two to three hours; sunrise late morning, sunset early afternoon. Then south to Helsinki — city and design after the snow. From Hong Kong the usual way in is via Helsinki to Rovaniemi. Aurora is possible in December. It is not a promise.";

export const LAPLAND_HOOK_ZH = "十二月。聖誕老人村在北極圈上，然後往南到赫爾辛基。";
export const LAPLAND_HOOK_EN = "December. Santa Claus Village on the Arctic Circle, then south to Helsinki.";

export const LAPLAND_SEASON_LABEL = "十二月 · 深冬 / December · midwinter";

export type VisualPathKind = "family" | "garnish";

export type LaplandVisualBeat = {
  credit: string | null;
  en: string;
  kind: VisualPathKind;
  kicker: string;
  photoId: string;
  title: string;
  zh: string;
};

export const LAPLAND_VISUAL_PATH: LaplandVisualBeat[] = [
  {
    credit: null,
    en: "Snow stuck to a cabin window at night. The photographs already begin in Lapland.",
    kind: "family",
    kicker: "深冬 / Midwinter",
    photoId: "photo_lapland_dump_window",
    title: "已經在雪裡 / Already in the snow",
    zh: "夜間，雪黏在小屋窗上。照片開始時，人已經在拉普蘭。",
  },
  {
    credit: null,
    en: "Santa Claus’ Main Post Office, Arctic Circle, Finland 66° 32′ 35″.",
    kind: "family",
    kicker: "聖誕季 / Christmas window",
    photoId: "photo_lapland_dump_post_office",
    title: "聖誕老人村主郵局 / Santa Claus’ Main Post Office",
    zh: "聖誕老人村主郵局，北極圈 66° 32′ 35″。",
  },
  {
    credit: null,
    en: "Red Arctic Circle pillars in the square at Santa Claus Village.",
    kind: "family",
    kicker: "北極圈 / Arctic Circle",
    photoId: "photo_lapland_dump_arctic_pillars",
    title: "北極圈紅柱 / Arctic Circle pillars",
    zh: "聖誕老人村廣場上的北極圈紅柱。",
  },
  {
    credit: null,
    en: "The Arctic Circle sign in the square: 66° 32′ 35″, Rovaniemi, santaclausvillage.info. You can walk across the line.",
    kind: "family",
    kicker: "北極圈 / Arctic Circle",
    photoId: "photo_lapland_dump_arctic_sign",
    title: "北極圈標牌 / Arctic Circle sign",
    zh: "廣場上的北極圈標牌：66° 32′ 35″，Rovaniemi，santaclausvillage.info。那條線可以走過去。",
  },
  {
    credit: null,
    en: "Red wooden cabin no. 4. Snowmen, and a Stiga sled on the porch.",
    kind: "family",
    kicker: "村裡過夜 / Village stay",
    photoId: "photo_lapland_dump_cabin4",
    title: "4 號紅木屋 / Red cabin no. 4",
    zh: "4 號紅木屋。雪人，門廊上有一架 Stiga 雪橇。",
  },
  {
    credit: null,
    en: "Finnair on snow at Rovaniemi. Leaving, not arriving.",
    kind: "family",
    kicker: "離開 / Leaving",
    photoId: "photo_lapland_dump_finnair",
    title: "雪地停機坪 / Snow on the tarmac",
    zh: "羅瓦涅米停機坪積雪。Finnair，是離開，不是抵達。",
  },
  {
    credit: null,
    en: "A grand hotel staircase. Helsinki after the snow.",
    kind: "family",
    kicker: "然後城市 / Then the city",
    photoId: "photo_lapland_dump_staircase",
    title: "赫爾辛基解凍 / Helsinki thaw",
    zh: "飯店大樓梯。雪之後是赫爾辛基。",
  },
  {
    credit: "Wikimedia Commons · Public domain · Veritas-iustitia-libertas",
    en: "Helsinki Cathedral in winter. Place photograph, not from this family trip.",
    kind: "garnish",
    kicker: "場所圖 / Place photo",
    photoId: "photo_lapland_garnish_cathedral",
    title: "赫爾辛基主教座堂 / Helsinki Cathedral",
    zh: "冬日的赫爾辛基主教座堂。場所圖，不是這次家庭照片。",
  },
  {
    credit: "Wikimedia Commons · CC BY 2.0 · Ninara",
    en: "South Harbour in winter. Place photograph, not from this family trip.",
    kind: "garnish",
    kicker: "場所圖 / Place photo",
    photoId: "photo_lapland_garnish_harbour",
    title: "南港 / South Harbour",
    zh: "冬日南港。場所圖，不是這次家庭照片。",
  },
];

export type LaplandPlaceFact = {
  en: string;
  title: string;
  zh: string;
};

export const LAPLAND_PLACE_KNOWLEDGE: LaplandPlaceFact[] = [
  {
    en: "Rovaniemi in mid-December is not full polar night. Daylight lasts about two to three hours; near the winter solstice it shrinks to about two hours fifteen minutes. Sunrise late morning, sunset early afternoon.",
    title: "極地暮光 / Polar twilight",
    zh: "羅瓦涅米十二月中不是極夜。白晝大約兩三小時；接近冬至最短約兩小時十五分。日出近中午，日落在下午。",
  },
  {
    en: "Northern lights are possible in December. They are not a promise. This journal has no aurora photograph.",
    title: "極光不是保證 / Aurora is not a promise",
    zh: "十二月有機會看到極光。那不是保證。這本遊記沒有極光照片。",
  },
  {
    en: "Usual routing from Hong Kong is Finnair via Helsinki (HEL), then a short flight to Rovaniemi (RVN). These photographs already begin in Lapland, then continue south to Helsinki.",
    title: "HKG–HEL–RVN",
    zh: "從香港通常搭 Finnair 經赫爾辛基（HEL），再短飛羅瓦涅米（RVN）。這組照片開始時人已經在拉普蘭，然後往南到赫爾辛基。",
  },
  {
    en: "Santa Claus Village, Tähtikuja 1, 96930 Napapiiri. The Arctic Circle line runs through the square.",
    title: "聖誕老人村 / Santa Claus Village",
    zh: "聖誕老人村，Tähtikuja 1, 96930 Napapiiri。北極圈線穿過廣場。",
  },
];

export const LAPLAND_GARNISH_CREDIT_ZH = "場所圖，不是這次家庭照片。";
export const LAPLAND_GARNISH_CREDIT_EN = "Place photograph, not from this family trip.";

export function isLaplandStorefrontSlug(slug: string): boolean {
  return isLaplandPublicSlug(slug);
}

export function forLaplandPublicPage(trip: TripDetail): TripDetail {
  const costYear = trip.startDate.slice(0, 4);
  return {
    ...trip,
    createdAt: "",
    endDate: costYear,
    startDate: costYear,
    updatedAt: "",
    costs: trip.costs.map((cost) => ({
      ...cost,
      createdAt: "",
      paidAt: cost.paidAt.slice(0, 4) || costYear,
    })),
    journalEntries: trip.journalEntries.map((entry) => ({
      ...entry,
      createdAt: "",
      entryDate: "",
      updatedAt: "",
    })),
    photos: trip.photos.map((photo) => ({
      ...photo,
      createdAt: "",
      takenAt: null,
    })),
    places: trip.places.map((place) => ({
      ...place,
      createdAt: "",
      updatedAt: "",
    })),
    travelRoute: (trip.travelRoute ?? []).map((segment) => ({
      ...segment,
      createdAt: "",
      updatedAt: "",
    })),
  };
}

export function storefrontCopyLooksInvented(text: string): boolean {
  return (
    /https?:\/\//i.test(text) ||
    /tripadvisor|google review|\bstars?\b|visitors a year|million tourists/i.test(text) ||
    /€\s?\d|HK\$\s?\d|US\$\s?\d|\b\d+\/5\b/.test(text)
  );
}
