import Link from "next/link";
import { readContent } from "@/lib/editable-store";
import type { Photo, TripDetail } from "@/lib/types";

export const dynamic = "force-dynamic";

function articleHref(trip: TripDetail) {
  return `/trips/${trip.slug}`;
}

function isRenderablePhoto(photo: Photo) {
  return photo.storageKey.startsWith("http") || photo.storageKey.startsWith("/");
}

function getCoverPhoto(trip: TripDetail) {
  return (
    trip.photos.find((photo) => photo.id === trip.coverPhotoId && isRenderablePhoto(photo)) ??
    trip.photos.find(isRenderablePhoto)
  );
}

function getTravelDays(trip: TripDetail) {
  const days = Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400000) + 1;
  return String(Math.max(1, days));
}

export default async function Home() {
  const { content } = await readContent();
  const trips = [...content.trips].sort((first, second) => second.startDate.localeCompare(first.startDate));
  const featuredTrip = content.trips.find((trip) => trip.id === "trip_lapland_2020") ?? trips[0];
  const featuredHref = articleHref(featuredTrip);
  const coverPhoto = getCoverPhoto(featuredTrip);
  const supportingPhotos = featuredTrip.photos
    .filter(isRenderablePhoto)
    .filter((photo) => photo.id !== coverPhoto?.id)
    .slice(0, 3);

  const stats = [
    { label: "目的地 / Destination", value: featuredTrip.country },
    { label: "旅程天數 / Days", value: getTravelDays(featuredTrip) },
    { label: "照片 / Photos", value: String(featuredTrip.photos.length) },
    { label: "收藏地點 / Stops", value: String(featuredTrip.places.length) },
  ];

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          <nav className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium uppercase text-teal-700">TravelOS</p>
              <Link className="group mt-2 block max-w-4xl" href={featuredHref}>
                <h1 className="text-3xl font-semibold tracking-normal text-zinc-950 transition group-hover:text-teal-800 sm:text-5xl lg:text-6xl">
                  {featuredTrip.title}
                </h1>
              </Link>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base">{featuredTrip.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
              <Link className="rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-950" href="/map">
                地圖 / Map
              </Link>
              <Link className="rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-950" href="/timeline">
                時間線 / Timeline
              </Link>
              <Link className="rounded-md border border-zinc-300 px-3 py-2 text-center text-sm font-medium text-zinc-950" href="/costs">
                費用 / Costs
              </Link>
              <Link className="rounded-md bg-teal-700 px-3 py-2 text-center text-sm font-medium text-white" href="/admin">
                編輯 / Edit
              </Link>
              <Link className="col-span-2 rounded-md bg-zinc-950 px-3 py-2 text-center text-sm font-medium text-white sm:col-span-1" href="/trips">
                全部旅程 / Trips
              </Link>
            </div>
          </nav>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4 sm:p-5" key={item.label}>
                <p className="text-sm text-zinc-500">{item.label}</p>
                <p className="mt-2 text-2xl font-semibold sm:mt-3 sm:text-3xl">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold sm:text-2xl">精選旅程 / Featured Article</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
                點擊標題、主照片或下方按鈕，都會進入這段旅程的完整文章。未來新增第二篇、第三篇旅程時，也會依照各自的網址自動連接。
                <span className="mt-2 block">
                  The homepage uses each journey slug, so every future article can open through its own route without new hard-coded pages.
                </span>
              </p>
            </div>
            <Link className="rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white" href={featuredHref}>
              閱讀文章 / Read article
            </Link>
          </div>

          <Link
            aria-label={`Open ${featuredTrip.title}`}
            className="mt-6 grid gap-3 rounded-lg border border-zinc-200 bg-stone-100 p-2 transition hover:border-teal-700 sm:mt-8 sm:grid-cols-3 sm:p-3"
            href={featuredHref}
          >
            {coverPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={coverPhoto.caption ?? featuredTrip.title}
                className="h-64 w-full rounded-md object-cover sm:col-span-2 sm:h-full sm:min-h-[320px]"
                src={coverPhoto.storageKey}
              />
            ) : (
              <div className="grid h-64 place-items-center rounded-md bg-stone-200 text-sm font-medium text-zinc-500 sm:col-span-2 sm:min-h-[320px]">
                Photo pending
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
              {supportingPhotos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={photo.caption ?? photo.originalFilename}
                  className="h-32 w-full rounded-md object-cover sm:h-40"
                  key={photo.id}
                  src={photo.storageKey}
                />
              ))}
            </div>
          </Link>
        </div>

        <aside className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold sm:text-xl">最新旅程 / Latest Journeys</h2>
            <div className="mt-5 space-y-4">
              {trips.slice(0, 4).map((trip) => (
                <article className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0" key={trip.id}>
                  <Link className="font-medium text-zinc-950 hover:text-teal-800" href={articleHref(trip)}>
                    {trip.title}
                  </Link>
                  <p className="mt-1 text-sm text-zinc-500">
                    {trip.city}, {trip.country}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{trip.summary}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4 sm:p-6">
            <h2 className="text-lg font-semibold sm:text-xl">整理進度 / Working Queue</h2>
            <ol className="mt-5 space-y-3">
              {[
                "完善精選遊記 / Refine featured journal",
                "補齊照片與說明 / Complete photos and captions",
                "同步地圖與時間線 / Sync map and timeline",
                "保留網頁編輯能力 / Keep browser editing ready",
              ].map((task, index) => (
                <li className="flex gap-3 text-sm" key={task}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-950 text-xs font-semibold text-white">{index + 1}</span>
                  <span className="pt-1 text-zinc-700">{task}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </main>
  );
}
