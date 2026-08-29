export const FAMILY_TRIP_TZ = "Asia/Taipei";
export const FAMILY_TRIP_START = "2026-08-30";
export const FAMILY_TRIP_TITLE = "福岡 • 大分";
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

export type Breakfast = "yes" | "no" | "unknown";
export type LegKind = "flight" | "car" | "hotel";

export type TripRef = {
  label: string;
  value: string;
};

type LegBase = {
  english: string;
  kind: LegKind;
  refs: TripRef[];
  sticker: string;
};

export type FlightLeg = LegBase & {
  flight: string;
  kind: "flight";
  route: string;
  routeLabel: "去程" | "回程";
  time: string;
};

export type CarLeg = LegBase & {
  brand: string;
  dropoff: string;
  kind: "car";
  model: string;
  pickup: string;
};

export type HotelLeg = LegBase & {
  breakfast: Breakfast;
  checkIn: string;
  checkOut: string;
  compact?: boolean;
  dinner: Breakfast;
  extras: string;
  kind: "hotel";
  name: string;
  note: string;
  official: TripRef[];
  officialIn: string;
  officialOut: string;
};

export type TripLeg = FlightLeg | CarLeg | HotelLeg;

export type FamilyTripDay = {
  breakfast: Breakfast;
  date: string;
  day: number;
  dinner: Breakfast;
  legs: TripLeg[];
  next: string;
  stay: string;
};

export const familyTripCarry = {
  car: [
    "Nissan 26082202410",
    "8/30 19:30 熊本機場取車",
    "9/6 19:00 同店還車",
    "(W4) SERENA",
    "有車，不用車站接送",
  ],
  flights: ["JX316 台中 T2 15:00 → 熊本 18:15", "JX317 熊本 19:15 → 台中 20:45", "PNR FCX2TD"],
  title: "帶著走",
};

const outboundFlight: FlightLeg = {
  english: "flight",
  flight: "STARLUX JX316",
  kind: "flight",
  refs: [{ label: "PNR", value: "FCX2TD" }],
  route: "台中 RMQ T2 → 熊本 KMJ",
  routeLabel: "去程",
  sticker: "飛機",
  time: "15:00–18:15",
};

const returnFlight: FlightLeg = {
  english: "flight",
  flight: "STARLUX JX317",
  kind: "flight",
  refs: [{ label: "PNR", value: "FCX2TD" }],
  route: "熊本 KMJ → 台中 RMQ",
  routeLabel: "回程",
  sticker: "飛機",
  time: "19:15–20:45",
};

const nissanPickup: CarLeg = {
  brand: "Nissan Rent a Car",
  dropoff: "9/6 19:00 同店",
  english: "Nissan",
  kind: "car",
  model: "(W4) SERENA",
  pickup: "熊本機場 19:30",
  refs: [
    { label: "預約號", value: "26082202410" },
    { label: "地址", value: "861-2204熊本縣上益城郡益城町大字小谷1802-2" },
    { label: "電話", value: "096-287-1355" },
  ],
  sticker: "車子",
};

const nissanDropoff: CarLeg = {
  brand: "Nissan Rent a Car",
  dropoff: "熊本機場 19:00 同店",
  english: "Nissan",
  kind: "car",
  model: "(W4) SERENA",
  pickup: "",
  refs: [{ label: "預約號", value: "26082202410" }],
  sticker: "車子",
};

const yufuinHotel: HotelLeg = {
  breakfast: "yes",
  checkIn: "8/31 14:30",
  checkOut: "9/1 11:00",
  dinner: "no",
  english: "",
  extras: "官網 いろは 16:10/16:30/17:10（15分）；湯上がりかぼす蜜；圖書室飲料 24h。",
  kind: "hotel",
  name: "界 由布院",
  note: "",
  official: [
    { label: "地址", value: "大分県由布市湯布院町川上398" },
    { label: "予約", value: "050-3134-8092" },
    { label: "夜間緊急", value: "0977-76-5283" },
    { label: "信箱", value: "yufuin@kai-ryokan.jp" },
  ],
  officialIn: "",
  officialOut: "",
  refs: [
    { label: "訂房號", value: "KYIBNF266359" },
    { label: "房間", value: "兩間 Japanese-style Room with Outdoor Bath RA3，4人" },
    { label: "早餐時間", value: "申請 8:45（4人）" },
  ],
  sticker: "住宿",
};

const umehibikiHotel: HotelLeg = {
  breakfast: "yes",
  checkIn: "9/1 15:00",
  checkOut: "9/2 11:00",
  dinner: "no",
  english: "",
  extras: "官網 梅酒蔵約十種免費試飲；藤五郎 20:00–23:00；房內歡迎甜點。",
  kind: "hotel",
  name: "奥日田温泉 うめひびき",
  note: "",
  official: [],
  officialIn: "最晚 18:00",
  officialOut: "",
  refs: [
    { label: "訂房號", value: "202608240003264.01" },
    { label: "房間", value: "OUSHUKU DELUXE 和洋室露天風呂" },
    { label: "地址", value: "4587 Nishioyama, Oyama-cho, Hita-shi, Oita 877-0201" },
    { label: "電話", value: "0973-52-3700" },
  ],
  sticker: "住宿",
};

const kujuHotel: HotelLeg = {
  breakfast: "yes",
  checkIn: "9/2 15:00",
  checkOut: "9/3 11:00",
  dinner: "yes",
  english: "",
  extras: "官網 入住歡迎飲；冰箱飲料免費；晚餐在レーゲンボーゲン。",
  kind: "hotel",
  name: "フリューゲル久住",
  note: "",
  official: [
    { label: "地址", value: "大分県竹田市久住町大字栢木6049-89" },
    { label: "電話", value: "0974-64-7839" },
  ],
  officialIn: "15:00–18:00（更晚先打電話）",
  officialOut: "",
  refs: [
    { label: "予約", value: "1252" },
    { label: "房間", value: "スターライトルーム 天然露天風呂付和洋室，2室4人" },
    { label: "餐食", value: "朝夕食付" },
    { label: "交通", value: "車" },
  ],
  sticker: "住宿",
};

const solariaPlaceRefs: TripRef[] = [
  { label: "地址", value: "福岡県福岡市中央区天神２丁目２−４３" },
  { label: "電話", value: "092-761-6500" },
];

const solariaArrivalHotel: HotelLeg = {
  breakfast: "no",
  checkIn: "8/30",
  checkOut: "8/31",
  dinner: "no",
  english: "Solaria",
  extras: "明早含早餐（官網週末約 7:00–10:30）。",
  kind: "hotel",
  name: "西鉄ホテル福岡 Solaria",
  note: "",
  official: [],
  officialIn: "15:00",
  officialOut: "11:00",
  refs: [
    { label: "訂房號", value: "TF53AEFAC2A33" },
    { label: "房型", value: "Moderate Twin（禁煙）" },
    { label: "計畫", value: "含早餐，不可取消已付" },
    { label: "旅客", value: "Chih Mei Feng" },
    { label: "收件", value: "Tik Shan Sana Lai" },
    { label: "金額", value: "¥43,580" },
    ...solariaPlaceRefs,
  ],
  sticker: "住宿",
};

const solariaReturnHotel: HotelLeg = {
  breakfast: "yes",
  checkIn: "9/3 15:00",
  checkOut: "9/5",
  dinner: "no",
  english: "Solaria",
  extras: "素泊り從明早算。櫃台可加早餐。",
  kind: "hotel",
  name: "西鉄ホテル福岡 Solaria",
  note: "",
  official: [],
  officialIn: "",
  officialOut: "11:00",
  refs: [
    { label: "訂房號", value: "T032CA29B451B" },
    { label: "房型", value: "スーペリアツイン 禁煙 ×2，4人" },
    { label: "計畫", value: "素泊り" },
    ...solariaPlaceRefs,
  ],
  sticker: "住宿",
};

const solariaStayOn: HotelLeg = {
  ...solariaReturnHotel,
  breakfast: "no",
  compact: true,
  extras: "今早素泊り。",
  refs: [],
};

const solariaCheckout: HotelLeg = {
  ...solariaReturnHotel,
  breakfast: "no",
  compact: true,
  dinner: "unknown",
  extras: "今早素泊り。",
  refs: [{ label: "訂房號", value: "T032CA29B451B" }],
};

function emptyDay(day: number, date: string, patch: Partial<FamilyTripDay> = {}): FamilyTripDay {
  return {
    breakfast: "unknown",
    date,
    day,
    dinner: "unknown",
    legs: [],
    next: "",
    stay: "",
    ...patch,
  };
}

export const familyTripDays: FamilyTripDay[] = [
  emptyDay(1, FAMILY_TRIP_DATES[0], {
    breakfast: "no",
    dinner: "no",
    legs: [outboundFlight, nissanPickup, solariaArrivalHotel],
    next: "熊本 18:15 落地，19:30 取車，開去天神。官網入住 15:00，這晚晚到。",
    stay: "Solaria",
  }),
  emptyDay(2, FAMILY_TRIP_DATES[1], {
    breakfast: "yes",
    dinner: "no",
    legs: [yufuinHotel],
    next: "開車從福岡去界。14:30 入住。",
    stay: "界 由布院",
  }),
  emptyDay(3, FAMILY_TRIP_DATES[2], {
    breakfast: "yes",
    dinner: "no",
    legs: [umehibikiHotel],
    next: "開車去うめひびき。15:00 入住。",
    stay: "奥日田温泉 うめひびき",
  }),
  emptyDay(4, FAMILY_TRIP_DATES[3], {
    breakfast: "yes",
    dinner: "yes",
    legs: [kujuHotel],
    next: "開車去フリューゲル。15:00 入住，最晚 18:00。這晚有晚餐。",
    stay: "フリューゲル久住",
  }),
  emptyDay(5, FAMILY_TRIP_DATES[4], {
    breakfast: "yes",
    dinner: "no",
    legs: [solariaReturnHotel],
    next: "フリューゲル 11:00 退房，開車回天神。15:00 入住。",
    stay: "Solaria",
  }),
  emptyDay(6, FAMILY_TRIP_DATES[5], {
    breakfast: "no",
    dinner: "no",
    legs: [solariaStayOn],
    next: "福岡。",
    stay: "Solaria 連泊",
  }),
  emptyDay(7, FAMILY_TRIP_DATES[6], {
    breakfast: "no",
    dinner: "unknown",
    legs: [solariaCheckout],
    next: "Solaria 官網 11:00 退房。今晚未訂。",
    stay: "今晚未訂",
  }),
  emptyDay(8, FAMILY_TRIP_DATES[7], {
    legs: [returnFlight, nissanDropoff],
    next: "熊本機場還車 19:00，JX317 19:15 起飛。",
    stay: "回家",
  }),
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
