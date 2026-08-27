import { isLaplandPublicSlug } from "@/lib/travelpayouts";
import type { Place, TripDetail } from "@/lib/types";

export const LAPLAND_STOREFRONT_KICKER = "為何去 / Why go";

export const LAPLAND_STOREFRONT_TITLE = "北極圈是一條可以走過去的線 / A line you can walk across";

export const LAPLAND_STOREFRONT_ZH =
  "你要去的不是極夜。羅瓦涅米的十二月，白天還在，只是只剩兩三小時。日出近中午才出來，日落在下午。暮光停在一天的正中間。雪把空氣裡的聲音拿走。窗上結冰。\n\n廣場上有一條線。走過去，就是北極圈。主郵局可以把一封信投入聖誕箱，讓它在那裡等到下一個十二月才寄出。村裡過夜：紅木屋、雪人、門廊上的雪橇。離開時，停機坪也是白的。往南，城市解凍。大理石樓梯，一杯熱的，港口還在。\n\n極光在十二月有機會。不是保證。這本遊記沒有極光照片。";

export const LAPLAND_STOREFRONT_EN =
  "You are not going for polar night. In Rovaniemi in December the day still exists. It is only two or three hours long. Sunrise near noon, sunset in the afternoon. Twilight sits at midday. Snow takes the sound out of the air. Ice on the glass.\n\nIn the square there is a line. Walk across it, and that is the Arctic Circle. At the Main Post Office you can put a letter in the Christmas box and let it wait until the next December. A night in the village: a red cabin, a snowman, a sled on the porch. When you leave, the tarmac is white too. South, the city thaws. Marble stairs, something hot in a mug, the harbour still there.\n\nAurora is possible in December. It is not a promise. This journal has no aurora photograph.";

export const LAPLAND_HOOK_ZH = "十二月。深冬。白晝只剩兩三小時。廣場上有一條線，走過去就是北極圈。然後往南，赫爾辛基。";
export const LAPLAND_HOOK_EN =
  "December. Midwinter. Two or three hours of daylight. A line in the square you can walk across. Then south, to Helsinki.";

export const LAPLAND_SEASON_LABEL = "十二月 · 深冬 / December · midwinter";

export const LAPLAND_PUBLIC_CUT_FILENAME = "Lapland_那年冬天_Public_Cut.mp4";
export const LAPLAND_PUBLIC_CUT_SRC = `/travelos/lapland/${LAPLAND_PUBLIC_CUT_FILENAME}`;
export const LAPLAND_PUBLIC_CUT_BYTES = 8946351;
export const LAPLAND_PUBLIC_CUT_SHA256 = "896c041b9442b593fded9d8c0c55eb97091439696d9c7bc8a89a2793064c156e";

export const LAPLAND_WINTER_VOCAL_F_FILENAME = "Lapland_那年冬天_WinterVocal_F.mp4";
export const LAPLAND_WINTER_VOCAL_F_BYTES = 8935024;
export const LAPLAND_WINTER_VOCAL_F_SHA256 = "fbdf340292780f34e98d4f9d822605b4c4671bd2976353d56249116801dd3c14";

export const LAPLAND_STILLS_DIR = "/travelos/lapland/stills";

export const LAPLAND_LOCKED_STILLS = [
  { role: "cover", filename: "cover_IMG_3619.jpeg", bytes: 227452, sha256: "f96221257264e2fb8f0c63c72a60424ab02f1a0db01f82bd80bb77d37023581a" },
  { role: "A", filename: "A_IMG_1037.jpeg", bytes: 386392, sha256: "d69513896b1051f75204723a05347bb73ca29fb46a6b9d01bc0cbcb30f00e289" },
  { role: "B", filename: "B_IMG_1060.jpeg", bytes: 543975, sha256: "8da1157875ced47013b2e8ed398b8709bbb6894fe7c67079aae7dc2fb9db605f" },
  { role: "C", filename: "C_IMG_1104.jpeg", bytes: 422071, sha256: "8c1dfbcc37d22362c866bf3f6491b19e8a1a9f21b2c829eed84a6e7d8f56b8ef" },
  { role: "D", filename: "D_IMG_3571.jpeg", bytes: 141543, sha256: "6919146dc41dec0391f7526a27e43298604e3ee9cac663231c2e5442e0a4d016" },
  { role: "E", filename: "E_IMG_3562.jpeg", bytes: 183993, sha256: "68c4bba6563e6d71ab00070008ad4903c9271ff8faa6dc2115212bf1c73ba2cb" },
  { role: "F", filename: "F_IMG_1314.jpeg", bytes: 158965, sha256: "132f4c690c150112ca92a9519038fa8a5d288913ae135830328596d76730c17d" },
  { role: "G", filename: "G_IMG_1299.jpeg", bytes: 278059, sha256: "67878c96041c4213584484cd39332c2a0b4d91f656705089273278902034f324" },
  { role: "H", filename: "H_IMG_3616.jpeg", bytes: 310916, sha256: "97762486f49f6f4eb37400bc7fa2090259eaa6400a6f068d610adeb1028ac3be" },
  { role: "I", filename: "I_IMG_3665.jpeg", bytes: 122598, sha256: "7382a2a11e4da77e4ee63163c78d74bc1ec95bb2fb7b507f516b76d7d84bb0de" },
  { role: "J", filename: "J_IMG_1372.jpeg", bytes: 614817, sha256: "eb1ed179395b005827280cb4d1bf06637a662ffa90011dca59d1239782c394c3" },
  { role: "K", filename: "K_IMG_1368.jpeg", bytes: 219940, sha256: "5b299ddade7ca6c913b40566bb335bb8aac3b245767832da75464eb6eab9930a" },
  { role: "L", filename: "L_IMG_8176.jpeg", bytes: 107827, sha256: "97b331a3219d97843efde08b605c44ea0262ee1d77b72fa269406139ba774e5e" },
  { role: "M", filename: "M_IMG_1379.jpeg", bytes: 87983, sha256: "8c5b8be40ed5e5d47f3bb0dccda0b0b352fd42e38736a42a92e36db8c64eeb0a" },
  { role: "N", filename: "N_IMG_1404.jpeg", bytes: 149267, sha256: "6eb2c64b65456c2d8d158c97bb8ec3b96793486e83a0af057cf9f2467439ffe8" },
  { role: "O", filename: "O_IMG_1429.jpeg", bytes: 253782, sha256: "00d2c732dd8c47218166e9d368338fc16162c3f78afcdab1647046bb0407afc6" },
  { role: "P", filename: "P_IMG_1412.jpeg", bytes: 249190, sha256: "e508363da5debeb971786f4f2b844ed55f4ad99b27980bdea4efc8ccb0599012" },
  { role: "Q", filename: "Q_IMG_1492.jpeg", bytes: 247522, sha256: "a932acba4374efa797883ae028ed7d09a86c89ae8c7438626fc5271062fdbefe" },
] as const;

export type VisualPathKind = "family" | "garnish";

export type LaplandVisualBeat = {
  credit: string | null;
  creditPlacement?: "caption" | "footer" | null;
  en: string;
  kind: VisualPathKind;
  kicker: string;
  photoId: string;
  sectionId?: string;
  title: string;
  zh: string;
};

export const LAPLAND_VISUAL_PATH: LaplandVisualBeat[] = [
  {
    credit: null,
    en: "Red Arctic Circle pillars and the conical roof of Santa Claus Office. A person is already in the frame.",
    kind: "family",
    kicker: "深冬 / Midwinter",
    photoId: "photo_lapland_still_cover",
    title: "北極圈紅柱 / Arctic Circle pillars",
    zh: "紅柱 ARCTIC CIRCLE，後是尖頂 Santa Claus Office 與暮光聖誕燈。人已入鏡。",
  },
  {
    credit: null,
    en: "The photographs already begin in Lapland. Shot from inside, looking up: ice on the glass, trees beyond it. Night, and the twilight has not gone far.",
    kind: "family",
    kicker: "聖誕窗 / Christmas window",
    photoId: "photo_lapland_still_a",
    sectionId: "christmas-window",
    title: "已經在雪裡 / Already in the snow",
    zh: "照片開始時，人已經在拉普蘭。從屋裡往上拍：冰霜結滿，外面是樹。夜間，暮光還沒走遠。",
  },
  {
    credit: null,
    en: "Glass cabins in the trees. Warm light, and the snow still falling.",
    kind: "family",
    kicker: "聖誕窗 / Christmas window",
    photoId: "photo_lapland_still_b",
    title: "雪地裡的玻璃小屋 / Glass cabins in the snow",
    zh: "林間的玻璃小屋。燈是暖的，雪還在下。",
  },
  {
    credit: null,
    en: "A seven-branch candelabra on the sill. Blue hour outside, lights in the tree. This is the Christmas window: warm in, cold out, glass in between.",
    kind: "family",
    kicker: "聖誕窗 / Christmas window",
    photoId: "photo_lapland_still_c",
    title: "窗台上的燭光 / Candlelight on the windowsill",
    zh: "七枝燭台在窗台上。外面是藍調，樹上有燈。聖誕窗就是這件事：裡暖，外冷，中間一塊玻璃。",
  },
  {
    credit: null,
    en: "Santa Claus’ Main Post Office. The banner reads Arctic Circle, 66° 32′ 35″.",
    kind: "family",
    kicker: "聖誕窗 / Christmas window",
    photoId: "photo_lapland_still_d",
    title: "聖誕老人村主郵局 / Santa Claus’ Main Post Office",
    zh: "聖誕老人村主郵局。橫幅寫著北極圈 66° 32′ 35″。",
  },
  {
    credit: null,
    en: "One box is daily mail. The Christmas box holds the letter until the next Christmas. Arctic Circle postmark.",
    kind: "family",
    kicker: "聖誕窗 / Christmas window",
    photoId: "photo_lapland_still_e",
    title: "等到下一個聖誕才寄出 / Held until the next Christmas",
    zh: "一箱信箱天天寄。一箱聖誕箱，投進去的信會留到下一個聖誕才寄出。北極圈郵戳。",
  },
  {
    credit: null,
    en: "The thermometer in the square has read −16. Not a climate promise. The number on the pillar that night.",
    kind: "family",
    kicker: "北極圈 / Arctic Circle",
    photoId: "photo_lapland_still_f",
    sectionId: "arctic-circle",
    title: "村裡的溫度計 / The village thermometer",
    zh: "廣場上的溫度計寫過 −16。不是氣候保證，是那根柱子上那晚的讀數。",
  },
  {
    credit: null,
    en: "The sign in the square. You can walk across the line.",
    kind: "family",
    kicker: "北極圈 / Arctic Circle",
    photoId: "photo_lapland_still_g",
    title: "北極圈標牌 / Arctic Circle sign",
    zh: "廣場上的標牌。那條線可以走過去。",
  },
  {
    credit: null,
    en: "Red pillars in a line through the square. Behind them, the conical roof of Santa Claus Office.",
    kind: "family",
    kicker: "北極圈 / Arctic Circle",
    photoId: "photo_lapland_still_h",
    title: "北極圈紅柱 / Arctic Circle pillars",
    zh: "紅柱排成一行，穿過廣場。後面是聖誕老人公會堂的尖頂。",
  },
  {
    credit: null,
    en: "Santa Claus Village square. Timber houses, snow, lights. Twilight still in the sky.",
    kind: "family",
    kicker: "北極圈 / Arctic Circle",
    photoId: "photo_lapland_still_i",
    title: "暮光裡的廣場 / The square in twilight",
    zh: "聖誕老人村廣場。木屋、積雪、燈。暮光還在。",
  },
  {
    credit: null,
    en: "Pines and birch. Snow holds the small trees down. Three trees in the distance still have lights on them. A cabin roof just shows.",
    kind: "family",
    kicker: "村裡過夜 / Village stay",
    photoId: "photo_lapland_still_j",
    title: "雪還壓在樹上 / Snow still on the trees",
    zh: "松和樺。雪把小樹壓住。遠處三棵樹上還掛著燈。小屋的屋頂剛露出一角。",
  },
  {
    credit: null,
    en: "Rovaniemi, a night in the village. Lit windows, snow on the roofs.",
    kind: "family",
    kicker: "村裡過夜 / Village stay",
    photoId: "photo_lapland_still_k",
    title: "村裡的紅木屋排 / Red cabins in the village",
    zh: "羅瓦涅米，村裡過夜。窗是亮的，屋頂是雪。",
  },
  {
    credit: null,
    en: "Red wooden cabin no. 4. A snowman, and a sled on the porch.",
    kind: "family",
    kicker: "村裡過夜 / Village stay",
    photoId: "photo_lapland_still_l",
    sectionId: "cabin-4",
    title: "4 號紅木屋 / Red cabin no. 4",
    zh: "4 號紅木屋。雪人，門廊上有一架雪橇。",
  },
  {
    credit: null,
    en: "Finnair on snow at Rovaniemi. Leaving, not arriving.",
    kind: "family",
    kicker: "離開 / Leaving",
    photoId: "photo_lapland_still_m",
    title: "雪地停機坪 / Snow on the tarmac",
    zh: "羅瓦涅米停機坪積雪。Finnair，是離開，不是抵達。",
  },
  {
    credit: null,
    en: "The city after the snow. A grand hotel staircase.",
    kind: "family",
    kicker: "然後城市 / Then the city",
    photoId: "photo_lapland_still_n",
    title: "赫爾辛基解凍 / Helsinki thaw",
    zh: "雪之後是城市。飯店大樓梯。",
  },
  {
    credit: null,
    en: "Toffle, on Arabia. The thaw starts with a mug.",
    kind: "family",
    kicker: "然後城市 / Then the city",
    photoId: "photo_lapland_still_o",
    title: "一杯熱的 / Something hot in a mug",
    zh: "Toffle，Arabia。解凍從一杯開始。",
  },
  {
    credit: null,
    en: "A design-hotel lobby. A chair larger than it needs to be, and a trunk marked for Christmas.",
    kind: "family",
    kicker: "然後城市 / Then the city",
    photoId: "photo_lapland_still_p",
    title: "大廳的木椅 / A wooden chair in the lobby",
    zh: "設計旅館大廳。椅子大過需要，箱子寫著聖誕。",
  },
  {
    credit: null,
    en: "The same lobby. The chess still on the table.",
    kind: "family",
    kicker: "然後城市 / Then the city",
    photoId: "photo_lapland_still_q",
    title: "大廳棋盤 / Lobby chess",
    zh: "同一大廳。棋還在桌上。",
  },
  {
    credit: "Wikimedia Commons · public domain · Veritas-iustitia-libertas",
    creditPlacement: "footer",
    en: "Helsinki Cathedral in winter.",
    kind: "garnish",
    kicker: "赫爾辛基 / Helsinki",
    photoId: "photo_lapland_garnish_cathedral",
    title: "赫爾辛基主教座堂 / Helsinki Cathedral",
    zh: "冬日的主教座堂。",
  },
  {
    credit: "Ninara · CC BY 2.0",
    creditPlacement: "caption",
    en: "South Harbour. The city’s sea, then further south.",
    kind: "garnish",
    kicker: "赫爾辛基 / Helsinki",
    photoId: "photo_lapland_garnish_harbour",
    title: "南港 / South Harbour",
    zh: "南港。城裡的海，然後更南。",
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
    en: "Santa Claus Village, Tähtikuja 1, 96930 Napapiiri. The Arctic Circle line runs through the square. The Main Post Office stamps Arctic Circle; letters in the Christmas box wait until the next Christmas.",
    title: "聖誕老人村 / Santa Claus Village",
    zh: "聖誕老人村，Tähtikuja 1, 96930 Napapiiri。北極圈線穿過廣場。主郵局可蓋北極圈郵戳；聖誕箱裡的信等到下一個聖誕才寄出。",
  },
];

export const LAPLAND_PLACE_KNOWLEDGE_HEADING = "去之前要知道的 / What to know before you go";

export const LAPLAND_PHOTO_CREDITS = [
  {
    id: "photo_lapland_garnish_cathedral",
    line: "Helsinki Cathedral — Wikimedia Commons, public domain (Veritas-iustitia-libertas).",
    lineZh: "赫爾辛基主教座堂 — Wikimedia Commons，公有領域（Veritas-iustitia-libertas）。",
  },
  {
    id: "photo_lapland_garnish_harbour",
    line: "South Harbour — Ninara, CC BY 2.0, via Wikimedia Commons.",
    lineZh: "南港 — Ninara，CC BY 2.0，via Wikimedia Commons.",
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

export const LAPLAND_STAY_JOURNAL_ID = "journal_lapland_cabin";

export type LaplandPublicStop = {
  detail: string;
  id: string;
  name: string;
  notes: string | null;
  rating: number | null;
};

export function isLaplandStayJournal(entry: { id: string; title?: string }): boolean {
  return entry.id === LAPLAND_STAY_JOURNAL_ID || /red cabin no\.?\s*4|4 號紅木屋/i.test(entry.title ?? "");
}

export function isLaplandPeerLandmarkName(name: string): boolean {
  return /santa claus village|arctic circle|main post office|helsinki cathedral|south harbour|聖誕老人村|北極圈|主郵局|主教座堂|南港/i.test(
    name,
  );
}

/** Public headline stops only. Village lodging stays in the journal/photo sequence, not this list. */
export function laplandPublicStops(places: Place[]): LaplandPublicStop[] {
  const santa = places.find((place) => place.id === "place_lapland_santa_village");
  const arctic = places.find((place) => place.id === "place_lapland_arctic_circle");
  const postOffice = places.find((place) => place.id === "place_lapland_post_office");
  const cathedral = places.find((place) => place.id === "place_lapland_helsinki_cathedral");
  const harbour = places.find((place) => place.id === "place_lapland_south_harbour");
  const cathedralBeat = LAPLAND_VISUAL_PATH.find((beat) => beat.photoId === "photo_lapland_garnish_cathedral");
  const harbourBeat = LAPLAND_VISUAL_PATH.find((beat) => beat.photoId === "photo_lapland_garnish_harbour");

  return [
    {
      detail: "Rovaniemi, Finland",
      id: santa?.id ?? "place_lapland_santa_village",
      name: "聖誕老人村 / Santa Claus Village",
      notes: santa?.notes ?? null,
      rating: santa?.rating ?? null,
    },
    {
      detail: "Rovaniemi, Finland",
      id: arctic?.id ?? "place_lapland_arctic_circle",
      name: "北極圈 / Arctic Circle Line",
      notes: arctic?.notes ?? null,
      rating: arctic?.rating ?? null,
    },
    {
      detail: "Rovaniemi, Finland",
      id: postOffice?.id ?? "place_lapland_post_office",
      name: "聖誕老人村主郵局 / Santa Claus’ Main Post Office",
      notes: postOffice?.notes ?? null,
      rating: postOffice?.rating ?? null,
    },
    {
      detail: "Helsinki, Finland",
      id: cathedral?.id ?? "place_lapland_helsinki_cathedral",
      name: cathedralBeat?.title ?? "赫爾辛基主教座堂 / Helsinki Cathedral",
      notes: cathedral?.notes ?? (cathedralBeat ? `${cathedralBeat.zh} / ${cathedralBeat.en}` : null),
      rating: cathedral?.rating ?? null,
    },
    {
      detail: "Helsinki, Finland",
      id: harbour?.id ?? "place_lapland_south_harbour",
      name: harbourBeat?.title ?? "南港 / South Harbour",
      notes: harbour?.notes ?? (harbourBeat ? `${harbourBeat.zh} / ${harbourBeat.en}` : null),
      rating: harbour?.rating ?? null,
    },
  ];
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
