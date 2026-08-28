import type { Metadata } from "next";
import Link from "next/link";
import { BookingBand } from "@/components/booking-band";
import { drivePageMetadata, getLaplandBooking, LAPLAND_COVER_PHOTO, LAPLAND_JOURNAL_PATH } from "@/lib/travelpayouts";

export const metadata: Metadata = {
  alternates: {
    canonical: "/drive",
  },
  description: drivePageMetadata.description,
  openGraph: {
    description: drivePageMetadata.description,
    images: [{ alt: "北極圈紅柱與聖誕老人村尖頂。 / Arctic Circle pillars and Santa Claus Office.", url: LAPLAND_COVER_PHOTO }],
    title: drivePageMetadata.title,
    type: "website",
    url: "/drive",
  },
  title: drivePageMetadata.title,
};

export default function DrivePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950" data-booking-desk="">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="inline-flex min-h-11 items-center text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <Link
              className="inline-flex min-h-11 items-center rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950"
              href={LAPLAND_JOURNAL_PATH}
            >
              遊記 / Journal
            </Link>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Go there</p>
            <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
              出發去拉普蘭 / Go to Lapland
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
              先讀羅瓦涅米的冬日遊記，再用下面的表格搜尋航班、住宿與活動。目的地是羅瓦涅米、赫爾辛基、聖誕老人村與北極圈。
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600">
              Read the Rovaniemi winter journal, then search flights, stays, and things to do. The destination language
              stays concrete: Rovaniemi, Helsinki, Santa Claus Village, and the Arctic Circle.
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
              alt="北極圈紅柱與聖誕老人村。 / Arctic Circle pillars at Santa Claus Village."
              className="h-48 w-full object-cover md:h-full"
              src={LAPLAND_COVER_PHOTO}
            />
            <div className="flex min-h-11 flex-col justify-center p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">Featured journal</p>
              <h2 className="mt-2 text-2xl font-semibold">芬蘭拉普蘭 / Finnish Lapland</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                十二月。深冬。白晝只剩兩三小時。廣場上有一條線，走過去就是北極圈。然後往南，赫爾辛基。
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                December. Midwinter. Two or three hours of daylight. A line in the square you can walk across. Then south, to Helsinki.
              </p>
              <p className="mt-4 text-sm font-semibold text-teal-800">閱讀遊記 / Read the journal</p>
            </div>
          </Link>
        </article>

        <div className="mt-6">
          <BookingBand destination={getLaplandBooking()} />
        </div>
      </section>
    </main>
  );
}
