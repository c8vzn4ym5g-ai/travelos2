export const LAPLAND_TRIP_SLUG = "finland-lapland-winter-journal";
export const LAPLAND_TRIP_SLUG_LEGACY = "finland-lapland-winter-journal-2020";
export const LAPLAND_TRIP_SLUG_LEGACY_2019 = "finland-lapland-winter-journal-2019";
export const LAPLAND_JOURNAL_PATH = `/trips/${LAPLAND_TRIP_SLUG}`;

export function isLaplandPublicSlug(slug: string): boolean {
  return slug === LAPLAND_TRIP_SLUG || slug === LAPLAND_TRIP_SLUG_LEGACY || slug === LAPLAND_TRIP_SLUG_LEGACY_2019;
}

export const LAPLAND_COVER_PHOTO = "/travelos/lapland/dump-arctic-circle-pillars.jpeg";

// Ordinary brand search URLs. Drive rewrites these on public pages.
// Verified by HTTP GET before shipping (2026-08-24):
// - aviasales.com/search with origin_iata/destination_iata/dates → 200
// - search.hotellook.com/?destination=Rovaniemi → live Hotellook search
//   (hotellook.com / www.hotellook.com fail TLS from this host)
// - klook.com/search/result/?query=Rovaniemi → 200
export const AVIASALES_SEARCH_URL = "https://www.aviasales.com/search";
export const HOTELLOOK_SEARCH_URL = "https://search.hotellook.com/";
export const KLOOK_SEARCH_URL = "https://www.klook.com/search/result/";

export type BookingDestination = {
  activitiesQuery: string;
  city: string;
  country: string;
  defaultDepartDate: string;
  defaultReturnDate: string;
  destinationIata: string;
  extraIata: string;
  originIata: string;
};

const LAPLAND_BOOKING_BASE = {
  activitiesQuery: "Rovaniemi",
  city: "Rovaniemi",
  country: "Finland",
  destinationIata: "RVN",
  extraIata: "HEL",
  originIata: "HKG",
} as const;

function utcYmd(year: number, monthIndex: number, day: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function utcDate(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day));
}

function isoUtc(date: Date): string {
  return utcYmd(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Next December quote week a stranger would search — not the 2019 itinerary, not a leftover January 2027 week. */
export function laplandQuoteDates(now = new Date()): Pick<BookingDestination, "defaultDepartDate" | "defaultReturnDate"> {
  const lead = utcDate(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 2);
  const year = lead.getUTCFullYear();

  if (lead.getUTCMonth() === 11) {
    if (lead.getUTCDate() <= 18) {
      return { defaultDepartDate: utcYmd(year, 11, 18), defaultReturnDate: utcYmd(year, 11, 25) };
    }

    return {
      defaultDepartDate: isoUtc(lead),
      defaultReturnDate: isoUtc(utcDate(lead.getUTCFullYear(), lead.getUTCMonth(), lead.getUTCDate() + 7)),
    };
  }

  return { defaultDepartDate: utcYmd(year, 11, 18), defaultReturnDate: utcYmd(year, 11, 25) };
}

export function getLaplandBooking(now = new Date()): BookingDestination {
  return {
    ...LAPLAND_BOOKING_BASE,
    ...laplandQuoteDates(now),
  };
}

export const laplandBooking: BookingDestination = getLaplandBooking();

export function aviasalesSearchUrl(originIata: string, destinationIata: string, departDate: string, returnDate: string) {
  const url = new URL(AVIASALES_SEARCH_URL);
  url.searchParams.set("origin_iata", originIata);
  url.searchParams.set("destination_iata", destinationIata);
  url.searchParams.set("depart_date", departDate);
  url.searchParams.set("return_date", returnDate);
  return url.toString();
}

export function hotellookSearchUrl(city: string, checkIn?: string, checkOut?: string) {
  const url = new URL(HOTELLOOK_SEARCH_URL);
  url.searchParams.set("destination", city);
  if (checkIn) {
    url.searchParams.set("checkIn", checkIn);
  }
  if (checkOut) {
    url.searchParams.set("checkOut", checkOut);
  }
  return url.toString();
}

export function klookActivitiesUrl(query: string) {
  const url = new URL(KLOOK_SEARCH_URL);
  url.searchParams.set("query", query);
  return url.toString();
}

export const drivePageMetadata = {
  description:
    "讀完羅瓦涅米遊記後，搜尋香港出發的航班、羅瓦涅米住宿，以及北極圈活動。 / After the Rovaniemi journal, search flights from Hong Kong, stays in Rovaniemi, and Arctic Circle things to do.",
  title: "出發去拉普蘭 / Go to Lapland — flights, stays, things to do",
};
