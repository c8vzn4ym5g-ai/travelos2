export const FAMILY_TRIP_TZ = "Asia/Taipei";
export const FAMILY_TRIP_START = "2026-08-30";
export const FAMILY_TRIP_TITLE = "福岡・大分";
export const FAMILY_TRIP_LEDE = "早上打開這頁。下一步會在最上頭。";
export const FAMILY_TRIP_FOOTER = "沒有接駁車。9/5 還沒訂。";
export const FAMILY_TRIP_SERENA_SRC = "/family/trip/serena.png";
export const FAMILY_TRIP_KMJ_MAP_SRC = "/family/trip/kmj-map.jpg";
export const SOLARIA_ARRIVAL_BOOKING = "TF53AEFAC2A33";
export const SOLARIA_RETURN_BOOKING = "T032CA29B451B";
export const KAI_YUFUIN_BOOKING = "KYIBNF266359";
export const UMEHIBIKI_BOOKING = "202608240003264.01";
export const FLUGEL_BOOKING = "1252";
export const NISSAN_RESERVATION = "26082202410";
export const STARLUX_PNR = "FCX2TD";
export const NISHIKAWA_CONFIRM = "fJR20h7nd";

export const FAMILY_TRIP_DATES = [
  "2026-08-30",
  "2026-08-31",
  "2026-09-01",
  "2026-09-02",
  "2026-09-03",
  "2026-09-04",
  "2026-09-05",
  "2026-09-06",
] as const;

export const FAMILY_TRIP_WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六", "日"] as const;

export type MealMark = "yes" | "no";
export type WeekTone = "honey" | "mint" | "blush" | "sky";
export type WeekIcon = "hotel" | "plane" | "car";
export type PlaceMark = "suggest" | "booked" | "requested";
export type PlaceKind = "main" | "backup" | "craft" | "coffee" | "shop";

export type FamilyTripPlace = {
  address: string;
  email?: string;
  hours?: string;
  kind: PlaceKind;
  mark: PlaceMark;
  name: string;
  nameJa?: string;
  note?: string;
  phone: string;
  url?: string;
};

export type FamilyTripDay = {
  address: string;
  blurb: string[];
  booking: string;
  breakfast: MealMark | null;
  breakfastNote: string;
  checkIn: string;
  checkOut: string;
  date: string;
  day: number;
  dinner: MealMark | null;
  dinnerNote: string;
  extra: string[];
  icons: WeekIcon[];
  nameJa: string;
  nameZh: string;
  pay: string;
  places: FamilyTripPlace[];
  tone: WeekTone;
  weekday: string;
};

export function placeMarkLabel(mark: PlaceMark) {
  if (mark === "booked") {
    return "已訂";
  }
  if (mark === "requested") {
    return "已發申請";
  }
  return "建議自訂";
}

export const familyTripDay1 = {
  car: {
    access: "訪客中心・走路3分・不用接駁",
    accessDetail: "D出口往左・08:00–20:00",
    dropoff: "9/6 19:00 同店",
    mapAlt: "熊本機場 D出口往訪客中心",
    mapSrc: FAMILY_TRIP_KMJ_MAP_SRC,
    name: "Nissan Serena",
    photoAlt: "Nissan Serena",
    photoSrc: FAMILY_TRIP_SERENA_SRC,
    pickup: "8/30 19:30 熊本機場",
    reservation: NISSAN_RESERVATION,
    sticker: "車子",
  },
  dateLabel: "8/30 日",
  flight: {
    number: "JX316",
    pnr: STARLUX_PNR,
    route: "RMQ → KMJ",
    routeLabel: "去程",
    sticker: "飛機",
    time: "15:00 → 18:15",
  },
  hotel: {
    address: "天神2-2-43",
    booking: SOLARIA_ARRIVAL_BOOKING,
    breakfast: "yes" as MealMark,
    checkIn: "預計車程 熊本機場→福岡 約1小時15分",
    checkOut: "11:00 官網",
    dinner: "no" as MealMark,
    nameJa: "ソラリア西鉄ホテル福岡",
    nameZh: "Solaria福岡",
    pay: "已付 ¥43,580 信用卡・不可退",
    sticker: "住宿",
  },
  next: "去搭飛機",
  nextDetail: "JX316 15:00 RMQ→KMJ",
};

export const familyTripReturn = {
  flight: {
    number: "JX317",
    pnr: STARLUX_PNR,
    route: "KMJ → RMQ",
    routeLabel: "回程",
    sticker: "飛機",
    time: "19:15",
  },
};

export const familyTripDays: FamilyTripDay[] = [
  {
    address: "天神2-2-43",
    blurb: ["不排行程、不排 REC。Solaria 只睡。"],
    booking: SOLARIA_ARRIVAL_BOOKING,
    breakfast: "yes",
    breakfastNote: "",
    checkIn: "預計車程 熊本機場→福岡 約1小時15分",
    checkOut: "11:00 官網",
    date: FAMILY_TRIP_DATES[0],
    day: 1,
    dinner: "no",
    dinnerNote: "",
    extra: ["只住一晚"],
    icons: ["hotel", "plane"],
    nameJa: "ソラリア西鉄ホテル福岡",
    nameZh: "Solaria福岡",
    pay: "已付 ¥43,580",
    places: [],
    tone: "honey",
    weekday: FAMILY_TRIP_WEEKDAYS[0],
  },
  {
    address: "川上398",
    blurb: ["11:00 退 Solaria，開車到界。金鱗湖可選。旅館晚餐不能加。"],
    booking: KAI_YUFUIN_BOOKING,
    breakfast: "yes",
    breakfastNote: "8:45",
    checkIn: "11:00 退 Solaria → 14:30 入界",
    checkOut: "",
    date: FAMILY_TRIP_DATES[1],
    day: 2,
    dinner: "no",
    dinnerNote: "不能加",
    extra: ["14:30入界", "可選 金鱗湖", "温泉小課 いろは 16:10", "晚餐 建議自訂"],
    icons: ["hotel", "car"],
    nameJa: "界 由布院",
    nameZh: "星野 界・由布院",
    pay: "已付 ¥141,000",
    places: [
      {
        address: "由布市湯布院町川北893-2",
        hours: "17:00–23:00 LO22:00",
        kind: "main",
        mark: "suggest",
        name: "亜李蘭離宮 湯布院本店",
        note: "燒肉・席のみ。橘套餐兩人分＋單點。",
        phone: "0977-76-8929",
      },
      {
        address: "由布市湯布院町川上3064-4",
        hours: "週四休，週一開",
        kind: "backup",
        mark: "suggest",
        name: "七厘焼き 和作",
        phone: "0977-85-2848",
        url: "https://www.yufuin-wasaku.com/",
      },
    ],
    tone: "mint",
    weekday: FAMILY_TRIP_WEEKDAYS[1],
  },
  {
    address: "西大山4587",
    blurb: ["先看窯與酒，城裡吃完再開車上山住梅響。酒吧 藤五郎 20:00。"],
    booking: UMEHIBIKI_BOOKING,
    breakfast: "yes",
    breakfastNote: "",
    checkIn: "15:00",
    checkOut: "",
    date: FAMILY_TRIP_DATES[2],
    day: 3,
    dinner: "no",
    dinnerNote: "",
    extra: ["15:00入", "酒吧 藤五郎 20:00", "晚餐 建議自訂"],
    icons: ["hotel", "car"],
    nameJa: "うめひびき",
    nameZh: "奧日田溫泉 梅響",
    pay: "到店付 ¥55,800",
    places: [
      {
        address: "日田市源栄町皿山",
        hours: "週二開；陶芸館週三休",
        kind: "craft",
        mark: "suggest",
        name: "小鹿田燒之里",
        nameJa: "小鹿田焼の里",
        phone: "0973-29-2020",
      },
      {
        address: "日田市中本町5-4",
        hours: "9:30–11:30 / 13:00–16:00 可走入",
        kind: "craft",
        mark: "suggest",
        name: "原次郎左衛門",
        phone: "0973-23-4145",
      },
      {
        address: "日田市豆田町6-31",
        hours: "9:00–16:30 可走入",
        kind: "craft",
        mark: "suggest",
        name: "薰長酒造",
        phone: "0973-22-3121",
      },
      {
        address: "日田市隈2-4-13",
        hours: "17:00–21:00 LO",
        kind: "main",
        mark: "suggest",
        name: "和くら",
        note: "日田吃完再開車上梅響。",
        phone: "0973-24-2728",
      },
      {
        address: "日田市丸の内町4-19",
        kind: "backup",
        mark: "suggest",
        name: "和食工房 新",
        phone: "0973-24-1618",
      },
    ],
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[2],
  },
  {
    address: "栢木6049-89",
    blurb: ["Flügel 含早晚餐，不另寫晚餐店。"],
    booking: FLUGEL_BOOKING,
    breakfast: "yes",
    breakfastNote: "",
    checkIn: "",
    checkOut: "",
    date: FAMILY_TRIP_DATES[3],
    day: 4,
    dinner: "yes",
    dinnerNote: "在旅館",
    extra: ["晚餐在旅館"],
    icons: ["hotel", "car"],
    nameJa: "フリューゲル久住",
    nameZh: "Flügel 久住",
    pay: "到店付 ¥149,600・入湯稅另計",
    places: [
      {
        address: "竹田市久住町大字久住6197",
        email: "info@kuju-senbazuru.co.jp",
        hours: "想 10:00 看，4 位大人・ライ サナ",
        kind: "craft",
        mark: "requested",
        name: "佐藤酒造 久住千羽鶴",
        note: "已發申請，還沒確認。",
        phone: "0974-76-0004",
      },
    ],
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[3],
  },
  {
    address: "天神2-2-43",
    blurb: ["素泊り。兩晚一次。ワンビル週四 15:30 關，入住後去天神南。"],
    booking: SOLARIA_RETURN_BOOKING,
    breakfast: "no",
    breakfastNote: "素泊り",
    checkIn: "15:00",
    checkOut: "",
    date: FAMILY_TRIP_DATES[4],
    day: 5,
    dinner: "no",
    dinnerNote: "",
    extra: ["15:00入天神", "晚餐 建議自訂"],
    icons: ["hotel"],
    nameJa: "ソラリア西鉄ホテル福岡",
    nameZh: "Solaria福岡",
    pay: "到店付 ¥156,868",
    places: [
      {
        address: "福岡市中央區天神1-11-1 ONE FUKUOKA BLDG. 6F",
        hours: "週四 8:00–15:30",
        kind: "coffee",
        mark: "suggest",
        name: "REC 天神ワンビル",
        phone: "092-753-8155",
      },
      {
        address: "福岡市中央區渡辺通5-1-19",
        hours: "10:00–22:00",
        kind: "coffee",
        mark: "suggest",
        name: "REC 天神南",
        note: "15:00 後入住用這間。",
        phone: "092-406-5214",
      },
      {
        address: "福岡市中央區今泉1-12-23",
        kind: "main",
        mark: "suggest",
        name: "喜水丸 今泉",
        note: "10 席。",
        phone: "092-401-8558",
      },
    ],
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[4],
  },
  {
    address: "天神2-2-43",
    blurb: ["同一間 Solaria。早上 REC ワンビル。下午西川。"],
    booking: SOLARIA_RETURN_BOOKING,
    breakfast: "no",
    breakfastNote: "",
    checkIn: "",
    checkOut: "",
    date: FAMILY_TRIP_DATES[5],
    day: 6,
    dinner: "no",
    dinnerNote: "",
    extra: ["西川 已訂 14:00", "晚餐 建議自訂"],
    icons: ["hotel"],
    nameJa: "ソラリア西鉄ホテル福岡",
    nameZh: "Solaria福岡",
    pay: "同一筆（兩晚）",
    places: [
      {
        address: "福岡市中央區天神1-11-1 ONE FUKUOKA BLDG. 6F",
        hours: "8:00–20:00",
        kind: "coffee",
        mark: "suggest",
        name: "REC 天神ワンビル",
        phone: "092-753-8155",
      },
      {
        address: "福岡市中央區天神2-1-1 福岡三越 B1",
        hours: "10:00–20:00・14:00–15:00",
        kind: "shop",
        mark: "booked",
        name: "西川ネムリウム 福岡三越",
        note: "確認號 fJR20h7nd・Ms Sana Lai",
        phone: "092-725-7615",
        url: "https://www.nishikawa1566.com/shops/fukuoka/100546/",
      },
      {
        address: "福岡市中央區天神3-2-3",
        kind: "main",
        mark: "suggest",
        name: "とりくら 天神本店",
        phone: "050-5448-5594",
        url: "https://tenjin-torikura.com/",
      },
    ],
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[5],
  },
  {
    address: "",
    blurb: ["Solaria 11:00 退。住宿還沒訂。輕的 REC 即可。"],
    booking: "",
    breakfast: "no",
    breakfastNote: "",
    checkIn: "",
    checkOut: "Solaria 11:00",
    date: FAMILY_TRIP_DATES[6],
    day: 7,
    dinner: null,
    dinnerNote: "",
    extra: ["Solaria 11:00退", "夜還沒訂"],
    icons: ["hotel"],
    nameJa: "",
    nameZh: "還沒訂",
    pay: "",
    places: [
      {
        address: "福岡市中央區渡辺通5-1-19",
        hours: "10:00–22:00",
        kind: "coffee",
        mark: "suggest",
        name: "REC 天神南",
        phone: "092-406-5214",
      },
    ],
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[6],
  },
  {
    address: "",
    blurb: ["還車後登機。不排觀光。"],
    booking: "",
    breakfast: null,
    breakfastNote: "",
    checkIn: "",
    checkOut: "",
    date: FAMILY_TRIP_DATES[7],
    day: 8,
    dinner: null,
    dinnerNote: "",
    extra: ["還車 19:00 ・ JX317 19:15"],
    icons: ["car", "plane"],
    nameJa: "",
    nameZh: "回程",
    pay: "",
    places: [],
    tone: "sky",
    weekday: FAMILY_TRIP_WEEKDAYS[7],
  },
];

export function taipeiCalendarDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: FAMILY_TRIP_TZ,
    year: "numeric",
  }).format(now);
}

export function tripDayFromCalendarDate(isoDate: string) {
  const index = FAMILY_TRIP_DATES.indexOf(isoDate as (typeof FAMILY_TRIP_DATES)[number]);
  return index === -1 ? null : index + 1;
}

export function defaultTripDay(now = new Date()) {
  return tripDayFromCalendarDate(taipeiCalendarDate(now)) ?? 1;
}

export function formatTripMd(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) {
    return "";
  }
  return `${Number(match[2])}/${Number(match[3])}`;
}

export function formatTripDateLabel(day: FamilyTripDay) {
  return `${formatTripMd(day.date)} ${day.weekday}`;
}
