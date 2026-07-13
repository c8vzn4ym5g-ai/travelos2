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

export default async function Home() {
  const { content } = await readContent();
  const trips = [...content.trips].sort((first, second) => second.startDate.localeCompare(first.startDate));
  const featuredTrip = content.trips.find((trip) => trip.id === "trip_lapland_2020") ?? trips[0];
  const featuredHref = articleHref(featuredTrip);
  const coverPhoto = getCoverPhoto(featuredTrip);
  const supportingPhotos = featuredTrip.photos.filter(isRenderablePhoto).filter((photo) => photo.id !== coverPhoto?.id).slice(0, 2);

  const stats = [
    { label: "精選旅程 / Featured", value: featuredTrip.country },
    { label: "旅行日數 / Days", value: String(Math.max(1, Math.round((Date.parse(featuredTrip.endDate) - Date.parse(featuredTrip.startDate)) / 86400000) + 1)) },
    { label: "影像記憶 / Photos", value: String(featuredTrip.photos.length) },
    { label: "收藏座標 / Stops", value: String(featuredTrip.places.length) },
  ];

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-8 lg:px-10">
          <nav className="flex items-start justify-between gap-6">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">TravelOS</p>
              <Link className="group mt-2 block max-w-4xl" href={featuredHref}>
                <h1 className="text-4xl font-semibold tracking-normal text-zinc-950 transition group-hover:text-teal-800 sm:text-6xl">
                  {featuredTrip.title}
                </h1>
              </Link>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-600">{featuredTrip.summary}</p>
            </div>
            <div className="hidden flex-wrap justify-end gap-2 sm:flex">
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/map">
                地圖 / Map
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/timeline">
                時間線 / Timeline
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/costs">
                花費 / Costs
              </Link>
              <Link className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white" href="/admin">
                編輯 / Edit
              </Link>
              <Link className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white" href="/trips">
                旅程 / Trips
              </Link>
            </div>
          </nav>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div className="rounded-lg border border-zinc-200 bg-stone-50 p-5" key={item.label}>
                <p className="text-sm text-zinc-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">精選文章 / Featured Article</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-zinc-600">
                這裡會自動連到目前精選旅程的完整文章；未來新增第二篇、第三篇時，也會使用各自的文章路徑。
                <span className="mt-2 block">
                  This entry links to the selected journey article. Future journals will use their own article paths automatically.
                </span>
              </p>
            </div>
            <Link className="rounded-md bg-zinc-950 px-4 py-3 text-center text-sm font-semibold text-white" href={featuredHref}>
              閱讀完整文章 / Read article
            </Link>
          </div>
          <Link
            aria-label={`Open ${featuredTrip.title}`}
            className="mt-8 grid min-h-[320px] gap-3 rounded-lg border border-zinc-200 bg-stone-100 p-3 transition hover:border-teal-700 sm:grid-cols-3"
            href={featuredHref}
          >
            {coverPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={coverPhoto.caption ?? featuredTrip.title}
                className="h-full min-h-[320px] w-full rounded-md object-cover sm:col-span-2"
                src={coverPhoto.storageKey}
              />
            ) : (
              <div className="grid min-h-[320px] place-items-center rounded-md bg-stone-200 text-sm font-medium text-zinc-500 sm:col-span-2">
                Photo pending
              </div>
            )}
            <div className="grid gap-3">
              {supportingPhotos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={photo.caption ?? photo.originalFilename} className="h-40 w-full rounded-md object-cover" key={photo.id} src={photo.storageKey} />
              ))}
            </div>
          </Link>
        </div>
        <aside className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">最新旅程 / Latest Journeys</h2>
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
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">整理進度 / Working Queue</h2>
            <ol className="mt-5 space-y-3">
              {[
                "整理精選文章 / Refine featured journal",
                "補完照片與說明 / Complete photos and captions",
                "同步地圖與時間線 / Sync map and timeline",
                "保留後續可編輯入口 / Keep browser editing ready",
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
