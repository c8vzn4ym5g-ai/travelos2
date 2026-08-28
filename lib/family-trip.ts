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
  kind: LegKind;
  sticker: string;
  english: string;
  refs: TripRef[];
};

export type FlightLeg = LegBase & {
  kind: "flight";
  route: string;
  flight: string;
  time: string;
};

export type CarLeg = LegBase & {
  kind: "car";
  brand: string;
  pickup: string;
  dropoff: string;
  model: string;
};

export type HotelLeg = LegBase & {
  kind: "hotel";
  name: string;
  checkIn: string;
  checkOut: string;
  breakfast: Breakfast;
};

export type TripLeg = FlightLeg | CarLeg | HotelLeg;

export type FamilyTripDay = {
  breakfast: Breakfast;
  date: string;
  day: number;
  legs: TripLeg[];
  next: string;
  stay: string;
};

const outboundFlight: FlightLeg = {
  english: "flight",
  flight: "STARLUX JX316",
  kind: "flight",
  refs: [
    { label: "PNR", value: "FCX2TD" },
    { label: "旅客", value: "CHIH HUNG CHAO" },
  ],
  route: "台中 RMQ →",
  sticker: "飛機",
  time: "",
};

const nissanCar: CarLeg = {
  brand: "Nissan Rent a Car",
  dropoff: "",
  english: "Nissan",
  kind: "car",
  model: "",
  pickup: "",
  refs: [{ label: "預約號", value: "26082202410" }],
  sticker: "車子",
};

const yufuinHotel: HotelLeg = {
  breakfast: "yes",
  checkIn: "2026-08-31 14:30",
  checkOut: "2026-09-01 11:00",
  english: "",
  kind: "hotel",
  name: "界 由布院",
  refs: [
    { label: "房間", value: "Japanese-style Room with Outdoor Bath RA3" },
    { label: "人數", value: "2 adults, 1 night" },
    { label: "接送", value: "JR 由布院駅免費接送，需預約" },
  ],
  sticker: "住宿",
};

const solariaHotel: HotelLeg = {
  breakfast: "no",
  checkIn: "2026-09-03 15:00",
  checkOut: "2026-09-05",
  english: "Solaria",
  kind: "hotel",
  name: "西鉄ホテル福岡 Solaria",
  refs: [
    { label: "訂房號", value: "T032CA29B451B" },
    { label: "地址", value: "福岡県福岡市中央区天神２丁目２−４３" },
    { label: "電話", value: "092-761-6500" },
    { label: "房型", value: "スーペリアツイン 禁煙 ×2" },
    { label: "計畫", value: "素泊り" },
    { label: "人數", value: "4 adults, 2 rooms" },
    { label: "費用", value: "¥78,434 / 室" },
    { label: "旅客", value: "Lai Tik Shan Sana" },
  ],
  sticker: "住宿",
};

function emptyDay(day: number, date: string, patch: Partial<FamilyTripDay> = {}): FamilyTripDay {
  return {
    breakfast: "unknown",
    date,
    day,
    legs: [],
    next: "",
    stay: "",
    ...patch,
  };
}

export const familyTripDays: FamilyTripDay[] = [
  emptyDay(1, FAMILY_TRIP_DATES[0], { legs: [outboundFlight, nissanCar] }),
  emptyDay(2, FAMILY_TRIP_DATES[1], {
    breakfast: "yes",
    legs: [yufuinHotel],
    stay: yufuinHotel.name,
  }),
  emptyDay(3, FAMILY_TRIP_DATES[2]),
  emptyDay(4, FAMILY_TRIP_DATES[3]),
  emptyDay(5, FAMILY_TRIP_DATES[4], {
    breakfast: "no",
    legs: [solariaHotel],
    stay: solariaHotel.name,
  }),
  emptyDay(6, FAMILY_TRIP_DATES[5], {
    breakfast: "no",
    legs: [solariaHotel],
    stay: solariaHotel.name,
  }),
  emptyDay(7, FAMILY_TRIP_DATES[6]),
  emptyDay(8, FAMILY_TRIP_DATES[7]),
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
