import type { Metadata } from "next";
import Link from "next/link";
import { AffiliateDisclosure } from "@/components/affiliate-disclosure";
import { drivePageMetadata, LAPLAND_COVER_PHOTO, LAPLAND_JOURNAL_PATH } from "@/lib/travelpayouts";

export const metadata: Metadata = {
  description: drivePageMetadata.description,
  openGraph: {
    description: drivePageMetadata.description,
    images: [{ alt: "Santa Claus Village at night in Rovaniemi", url: LAPLAND_COVER_PHOTO }],
    title: drivePageMetadata.title,
    type: "website",
    url: "/drive",
  },
  title: drivePageMetadata.title,
};

const bookingAreas = [
  {
    title: "Flights / 航班",
    descriptionZh: "飛入羅瓦涅米（RVN），或先到赫爾辛基（HEL）再北上。遊記在 1 月 18 日抵達羅瓦涅米。",
    descriptionEn: "Fly into Rovaniemi (RVN), or land in Helsinki (HEL) and continue north. The journal arrives in Rovaniemi on 18 January.",
  },
  {
    title: "Stays / 住宿",
    descriptionZh: "住在聖誕老人村附近，方便走到北極圈標記；或選一間雪屋，夜晚更靜。",
    descriptionEn: "Stay near Santa Claus Village for the Arctic Circle marker, or in a snow cabin for quieter nights.",
  },
  {
    title: "Things to do / 活動",
    descriptionZh: "日間可去聖誕老人村、北極圈線與雪橇，再回到鎮上或小屋。細節寫在遊記裡。",
    descriptionEn: "Day trips cover Santa Claus Village, the Arctic Circle line, and sledding, then return to town or the cabin. The journal has the named stops.",
  },
  {
    title: "Transport / 當地交通",
    descriptionZh: "羅瓦涅米市區、聖誕老人村與雪屋之間需要短程接送或當地交通，不必每天換住宿。",
    descriptionEn: "Short transfers link Rovaniemi, Santa Claus Village, and the snow cabin. You do not need to change lodging every day.",
  },
];

export default function DrivePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950" data-booking-desk="">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex min-h-11 items-center text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/trips">
                Travel
              </Link>
              <Link className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/coffee">
                Coffee
              </Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Plan & Book</p>
            <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
              策劃拉普蘭冬旅 / Plan a Lapland winter
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
              先讀公開遊記，再查航班、住宿、活動與當地交通。目的地名稱寫清楚，方便對應羅瓦涅米、赫爾辛基、聖誕老人村與北極圈。
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Read the public journal first, then look up flights, stays, activities, and local transport. Place names stay concrete: Rovaniemi, Helsinki, Santa Claus Village, and the Arctic Circle.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <article
          className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
          data-featured-destination="lapland"
        >
          <Link className="grid min-h-11 gap-0 md:grid-cols-[minmax(0,16rem)_1fr]" href={LAPLAND_JOURNAL_PATH}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="入夜後的聖誕老人村。 / Santa Claus Village at night."
              className="h-48 w-full object-cover md:h-full"
              src={LAPLAND_COVER_PHOTO}
            />
            <div className="flex min-h-11 flex-col justify-center p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Featured destination</p>
              <h2 className="mt-2 text-2xl font-semibold">芬蘭拉普蘭 / Finnish Lapland</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                2020 年 1 月，羅瓦涅米。聖誕老人村、北極圈、雪屋、雪橇與營火。點進遊記讀完整路線。
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                January 2020, Rovaniemi. Santa Claus Village, the Arctic Circle, a snow cabin, sledding, and a campfire.
              </p>
              <p className="mt-4 text-sm font-semibold text-teal-800">閱讀遊記 / Read the live journal</p>
            </div>
          </Link>
        </article>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {bookingAreas.map((area) => (
            <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" key={area.title}>
              <h2 className="text-xl font-semibold">{area.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{area.descriptionZh}</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">{area.descriptionEn}</p>
              <Link
                className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-teal-800"
                href={LAPLAND_JOURNAL_PATH}
              >
                在遊記裡看這一段 / See this in the journal
              </Link>
            </article>
          ))}
        </div>

        <AffiliateDisclosure className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950" />
      </section>
    </main>
  );
}
