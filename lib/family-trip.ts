export const FAMILY_TRIP_TZ = "Asia/Taipei";
export const FAMILY_TRIP_START = "2026-08-30";
export const FAMILY_TRIP_TITLE = "福岡・大分";
export const FAMILY_TRIP_LEDE = "早上打開這頁。下一步會在最上頭。";
export const FAMILY_TRIP_FOOTER = "沒有接駁車。9/5 還沒訂。";
export const FAMILY_TRIP_SERENA_SRC = "/family/trip/serena.png";
export const FAMILY_TRIP_KMJ_MAP_SRC = "/family/trip/kmj-map.jpg";
export const SOLARIA_ARRIVAL_BOOKING = "TF53AEFAC2A33";
export const SOLARIA_RETURN_BOOKING = "T032CA29B451B";
export const NISSAN_RESERVATION = "26082202410";
export const STARLUX_PNR = "FCX2TD";

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

export type FamilyTripDay = {
  breakfast: MealMark | null;
  breakfastNote: string;
  date: string;
  day: number;
  dinner: MealMark | null;
  extra: string[];
  icons: WeekIcon[];
  nameJa: string;
  nameZh: string;
  pay: string;
  tone: WeekTone;
  weekday: string;
};

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

export const familyTripDays: FamilyTripDay[] = [
  {
    breakfast: "yes",
    breakfastNote: "",
    date: FAMILY_TRIP_DATES[0],
    day: 1,
    dinner: "no",
    extra: [],
    icons: ["hotel", "plane"],
    nameJa: "ソラリア西鉄ホテル福岡",
    nameZh: "Solaria福岡",
    pay: "已付 ¥43,580",
    tone: "honey",
    weekday: FAMILY_TRIP_WEEKDAYS[0],
  },
  {
    breakfast: "yes",
    breakfastNote: "8:45",
    date: FAMILY_TRIP_DATES[1],
    day: 2,
    dinner: "no",
    extra: ["14:30入界", "温泉小課 いろは 16:10"],
    icons: ["hotel", "car"],
    nameJa: "界 由布院",
    nameZh: "星野 界・由布院",
    pay: "已付 ¥141,000",
    tone: "mint",
    weekday: FAMILY_TRIP_WEEKDAYS[1],
  },
  {
    breakfast: "yes",
    breakfastNote: "",
    date: FAMILY_TRIP_DATES[2],
    day: 3,
    dinner: "no",
    extra: ["15:00入", "梅酒試飲・酒吧 20:00"],
    icons: ["hotel", "car"],
    nameJa: "うめひびき",
    nameZh: "奧日田溫泉 梅響",
    pay: "到店付 ¥55,800",
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[2],
  },
  {
    breakfast: "yes",
    breakfastNote: "",
    date: FAMILY_TRIP_DATES[3],
    day: 4,
    dinner: "yes",
    extra: [],
    icons: ["hotel", "car"],
    nameJa: "フリューゲル久住",
    nameZh: "Flügel 久住",
    pay: "到店付 ¥149,600・入湯稅另計",
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[3],
  },
  {
    breakfast: "no",
    breakfastNote: "",
    date: FAMILY_TRIP_DATES[4],
    day: 5,
    dinner: "no",
    extra: ["15:00入天神"],
    icons: ["hotel"],
    nameJa: "ソラリア西鉄ホテル福岡",
    nameZh: "Solaria福岡",
    pay: "到店付 ¥156,868",
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[4],
  },
  {
    breakfast: "no",
    breakfastNote: "",
    date: FAMILY_TRIP_DATES[5],
    day: 6,
    dinner: "no",
    extra: [],
    icons: ["hotel"],
    nameJa: "ソラリア西鉄ホテル福岡",
    nameZh: "Solaria福岡",
    pay: "同一筆（兩晚）",
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[5],
  },
  {
    breakfast: "no",
    breakfastNote: "",
    date: FAMILY_TRIP_DATES[6],
    day: 7,
    dinner: null,
    extra: ["Solaria 11:00退"],
    icons: ["hotel"],
    nameJa: "",
    nameZh: "還沒訂",
    pay: "",
    tone: "blush",
    weekday: FAMILY_TRIP_WEEKDAYS[6],
  },
  {
    breakfast: null,
    breakfastNote: "",
    date: FAMILY_TRIP_DATES[7],
    day: 8,
    dinner: null,
    extra: ["還車 19:00 ・ JX317 19:15"],
    icons: ["car", "plane"],
    nameJa: "",
    nameZh: "回程",
    pay: "",
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
