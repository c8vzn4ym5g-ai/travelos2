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

export const laplandTripMetadata = {
  description:
    "芬蘭拉普蘭，2020 年 1 月。以羅瓦涅米為基地的冬日遊記：聖誕老人村、北極圈、雪屋與雪橇。可參考如何飛入羅瓦涅米或赫爾辛基，並安排北極圈日間行程。 / Finnish Lapland, January 2020. A Rovaniemi winter journal of Santa Claus Village, the Arctic Circle, a snow cabin, and sledding — plus how to fly into Rovaniemi or Helsinki.",
  title: "拉普蘭冬日記憶 / Lapland Winter Journal — Rovaniemi, Santa Claus Village, Arctic Circle",
};

export const drivePageMetadata = {
  description:
    "策劃一趟芬蘭拉普蘭冬旅：飛入羅瓦涅米或赫爾辛基，住在聖誕老人村附近或雪屋，並安排北極圈日間行程。先讀 2020 年遊記。 / Plan a Finnish Lapland winter: fly into Rovaniemi or Helsinki, stay near Santa Claus Village or a snow cabin, and plan Arctic Circle day trips. Read the 2020 journal first.",
  title: "策劃拉普蘭冬旅 / Plan a Lapland winter — flights, stays, Arctic Circle",
};
