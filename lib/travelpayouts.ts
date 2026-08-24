export const TRAVELPAYOUTS_DRIVE_SCRIPT_URL = "https://emrldtp.cc/NTUwMzEz.js?t=550313";
export const LAPLAND_TRIP_SLUG = "finland-lapland-winter-journal-2020";
export const LAPLAND_JOURNAL_PATH = `/trips/${LAPLAND_TRIP_SLUG}`;
export const LAPLAND_COVER_PHOTO = "/travelos/lapland/santa-village-night.jpeg";

export const PRIVATE_DRIVE_PATH_PREFIXES = [
  "/family",
  "/sana",
  "/trips/admin",
  "/coffee/admin",
  "/trips/new",
  "/coffee/new",
  "/trips/write",
] as const;

export function isPublicDrivePath(pathname: string): boolean {
  const path = pathname.split(/[?#]/, 1)[0] || "/";
  return !PRIVATE_DRIVE_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function travelpayoutsDriveHtml(pathname: string): string {
  if (!isPublicDrivePath(pathname)) {
    return "";
  }

  return `<script async data-cfasync="false" data-no-defer="1" data-noptimize="1" data-wpfc-render="false" id="travelpayouts-drive" seraph-accel-crit="1" src="${TRAVELPAYOUTS_DRIVE_SCRIPT_URL}"></script>`;
}

// Ordinary brand search URLs. Drive rewrites these on public pages.
// Verified by HTTP GET before shipping (2026-08-24):
// - aviasales.com/search with origin_iata/destination_iata/dates → 200
// - search.hotellook.com/?destination=Rovaniemi → live Hotellook search
//   (hotellook.com / www.hotellook.com fail TLS from this host)
// - klook.com/search/result/?query=Rovaniemi → 200
// GetYourGuide and Viator return HTTP 403 here, so they are not shipped.
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

export const laplandBooking: BookingDestination = {
  activitiesQuery: "Rovaniemi",
  city: "Rovaniemi",
  country: "Finland",
  defaultDepartDate: "2027-01-18",
  defaultReturnDate: "2027-01-25",
  destinationIata: "RVN",
  extraIata: "HEL",
  originIata: "HKG",
};

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

export const laplandTripMetadata = {
  description:
    "芬蘭拉普蘭冬日遊記，2020 年 1 月，羅瓦涅米。聖誕老人村、北極圈、雪屋與雪橇。可從香港飛入羅瓦涅米或赫爾辛基，再策劃住宿與日間行程。 / A Finnish Lapland winter journal, January 2020, Rovaniemi. Santa Claus Village, the Arctic Circle, a snow cabin, and sledding — then plan flights from Hong Kong into RVN or HEL.",
  title: "拉普蘭冬日記憶 / Lapland Winter Journal — read it, then plan the trip",
};

export const drivePageMetadata = {
  description:
    "讀完羅瓦涅米遊記後，搜尋香港出發的航班、羅瓦涅米住宿，以及北極圈活動。 / After the Rovaniemi journal, search flights from Hong Kong, stays in Rovaniemi, and Arctic Circle things to do.",
  title: "出發去拉普蘭 / Go to Lapland — flights, stays, things to do",
};
