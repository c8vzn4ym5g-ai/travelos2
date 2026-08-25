import { isLaplandPublicSlug } from "@/lib/travelpayouts";
import type { TripDetail } from "@/lib/types";

export const LAPLAND_STOREFRONT_KICKER = "為何去 / Why go";

export const LAPLAND_STOREFRONT_TITLE = "北極圈上的冬日小鎮，然後是城市 / A winter town on the Arctic Circle, then a city";

export const LAPLAND_STOREFRONT_ZH =
  "芬蘭拉普蘭，十二月。深冬，雪很厚，白晝只剩兩三小時，暮光像停在中午。聖誕老人村在北極圈上：木屋、積雪，廣場上有一條線，走過去就是北極圈。然後往南，解凍的赫爾辛基，港口與主教座堂，雪後是城市。從香港通常經赫爾辛基轉機進羅瓦涅米。極光在十二月有機會，但不是保證。";

export const LAPLAND_STOREFRONT_EN =
  "Finnish Lapland in December. Deep winter, heavy snow, and only two or three hours of daylight — twilight parked at midday. Santa Claus Village sits on the Arctic Circle: timber houses, snow, and a line in the square you can walk across. Then south, to Helsinki thawing by the harbour and the cathedral — city after snow. From Hong Kong the usual way in is via Helsinki to Rovaniemi. Aurora is possible in December. It is not a promise.";

export const LAPLAND_HOOK_ZH = "十二月。聖誕老人村在北極圈上，然後往南到赫爾辛基。";
export const LAPLAND_HOOK_EN = "December. Santa Claus Village on the Arctic Circle, then south to Helsinki.";

export const LAPLAND_SEASON_LABEL = "十二月 · 深冬 / December · midwinter";

export type VisualPathKind = "family" | "garnish";

export type LaplandVisualBeat = {
  credit: string | null;
  creditPlacement?: "caption" | "footer" | null;
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
    credit: "Wikimedia Commons · public domain · Veritas-iustitia-libertas",
    creditPlacement: "footer",
    en: "Helsinki Cathedral in winter.",
    kind: "garnish",
    kicker: "赫爾辛基 / Helsinki",
    photoId: "photo_lapland_garnish_cathedral",
    title: "赫爾辛基主教座堂 / Helsinki Cathedral",
    zh: "冬日的赫爾辛基主教座堂。",
  },
  {
    credit: "Ninara · CC BY 2.0",
    creditPlacement: "caption",
    en: "South Harbour in winter.",
    kind: "garnish",
    kicker: "赫爾辛基 / Helsinki",
    photoId: "photo_lapland_garnish_harbour",
    title: "南港 / South Harbour",
    zh: "冬日南港。",
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

export const LAPLAND_PHOTO_CREDITS = [
  {
    id: "photo_lapland_garnish_cathedral",
    line: "Helsinki Cathedral — Wikimedia Commons, public domain (Veritas-iustitia-libertas).",
    lineZh: "赫爾辛基主教座堂 — Wikimedia Commons，公有領域（Veritas-iustitia-libertas）。",
  },
  {
    id: "photo_lapland_garnish_harbour",
    line: "South Harbour — Ninara, CC BY 2.0, via Wikimedia Commons.",
    lineZh: "南港 — Ninara，CC BY 2.0，via Wikimedia Commons。",
  },
] as const;

export function isLaplandGarnishPhoto(photo: { id?: string; originalFilename?: string }) {
  return photo.id?.startsWith("photo_lapland_garnish_") || Boolean(photo.originalFilename?.startsWith("garnish-"));
}

export function garnishCaptionCredit(photoId: string) {
  const beat = LAPLAND_VISUAL_PATH.find((item) => item.photoId === photoId);
  if (beat?.creditPlacement === "caption") {
    return beat.credit;
  }

  return null;
}

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
