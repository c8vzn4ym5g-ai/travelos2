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
  const publicTrips = trips.filter((trip) => trip.visibility !== "private");
  const visibleTrips = publicTrips.length > 0 ? publicTrips : trips;
  const featuredTrip = visibleTrips.find((trip) => trip.id === "trip_lapland_2020") ?? visibleTrips[0];
  const featuredHref = articleHref(featuredTrip);
  const coverPhoto = getCoverPhoto(featuredTrip);
  const supportingPhotos = featuredTrip.photos
    .filter(isRenderablePhoto)
    .filter((photo) => photo.id !== coverPhoto?.id)
    .slice(0, 3);

  const stats = [
    { label: "\u76ee\u7684\u5730 / Destination", value: featuredTrip.country },
    { label: "\u65c5\u7a0b\u5929\u6578 / Days", value: getTravelDays(featuredTrip) },
    { label: "\u7167\u7247 / Photos", value: String(featuredTrip.photos.length) },
    { label: "\u6536\u85cf\u5730\u9ede / Stops", value: String(featuredTrip.places.length) },
  ];

  return (
    <main className="travel-shell">
      <section className="travel-hero">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 sm:py-10 lg:px-10">
          <nav className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="travel-kicker text-sm">TravelOS</p>
              <Link className="group mt-3 block max-w-4xl" href={featuredHref}>
                <h1 className="travel-hand text-4xl font-semibold leading-tight text-[color:var(--ink)] transition group-hover:text-[color:var(--pine)] sm:text-6xl lg:text-7xl">
                  {featuredTrip.title}
                </h1>
              </Link>
              <p className="travel-muted mt-5 max-w-3xl text-base leading-8 sm:text-lg">{featuredTrip.summary}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
              <Link className="travel-chip rounded-full px-4 py-2 text-center text-sm font-semibold" href="/map">
                {"\u5730\u5716 / Map"}
              </Link>
              <Link className="travel-chip rounded-full px-4 py-2 text-center text-sm font-semibold" href="/timeline">
                {"\u6642\u9593\u7dda / Timeline"}
              </Link>
              <Link className="travel-chip rounded-full px-4 py-2 text-center text-sm font-semibold" href="/costs">
                {"\u8cbb\u7528 / Costs"}
              </Link>
              <Link className="travel-chip rounded-full px-4 py-2 text-center text-sm font-semibold" href="/admin">
                {"\u7de8\u8f2f / Edit"}
              </Link>
              <Link className="travel-primary col-span-2 rounded-full px-4 py-2 text-center text-sm font-semibold sm:col-span-1" href="/trips">
                {"\u5168\u90e8\u65c5\u7a0b / Trips"}
              </Link>
            </div>
          </nav>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div className="travel-soft-panel rounded-3xl p-5" key={item.label}>
                <p className="travel-muted text-sm">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-[color:var(--pine)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-7 px-4 py-7 sm:px-6 sm:py-12 lg:grid-cols-[1.12fr_0.88fr] lg:px-10">
        <div className="travel-panel rounded-[2rem] p-4 sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="travel-hand text-2xl font-semibold sm:text-3xl">{"\u7cbe\u9078\u65c5\u7a0b / Featured Article"}</h2>
              <p className="travel-muted mt-3 max-w-2xl text-sm leading-7">
                {"\u9ede\u64ca\u6a19\u984c\u3001\u4e3b\u7167\u7247\u6216\u4e0b\u65b9\u6309\u9215\uff0c\u90fd\u6703\u9032\u5165\u9019\u6bb5\u65c5\u7a0b\u7684\u5b8c\u6574\u6587\u7ae0\u3002\u672a\u4f86\u65b0\u589e\u65c5\u7a0b\u6642\uff0c\u4e5f\u6703\u4f9d\u7167\u5404\u81ea\u7684\u7db2\u5740\u81ea\u52d5\u9023\u63a5\u3002"}
                <span className="mt-2 block">
                  Each journey keeps its own article path, so the site can grow without hard-coded pages.
                </span>
              </p>
            </div>
            <Link className="travel-primary rounded-full px-5 py-3 text-center text-sm font-semibold" href={featuredHref}>
              {"\u95b1\u8b80\u6587\u7ae0 / Read article"}
            </Link>
          </div>

          <Link
            aria-label={`Open ${featuredTrip.title}`}
            className="mt-7 grid gap-3 rounded-[1.5rem] bg-[color:var(--paper-soft)] p-2 transition hover:scale-[1.005] sm:mt-9 sm:grid-cols-3 sm:p-3"
            href={featuredHref}
          >
            {coverPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={coverPhoto.caption ?? featuredTrip.title}
                className="travel-photo h-72 w-full rounded-[1.25rem] object-cover sm:col-span-2 sm:h-full sm:min-h-[360px]"
                src={coverPhoto.storageKey}
              />
            ) : (
              <div className="grid h-72 place-items-center rounded-[1.25rem] bg-white/70 text-sm font-medium text-[color:var(--muted)] sm:col-span-2 sm:min-h-[360px]">
                Photo pending
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
              {supportingPhotos.map((photo) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={photo.caption ?? photo.originalFilename}
                  className="h-36 w-full rounded-[1.1rem] object-cover shadow-md sm:h-44"
                  key={photo.id}
                  src={photo.storageKey}
                />
              ))}
            </div>
          </Link>
        </div>

        <aside className="space-y-7">
          <div className="travel-panel rounded-[2rem] p-5 sm:p-7">
            <h2 className="travel-hand text-2xl font-semibold">{"\u6700\u65b0\u65c5\u7a0b / Latest Journeys"}</h2>
            <div className="travel-rule mt-5">
              {visibleTrips.slice(0, 4).map((trip) => (
                <article className="py-4 first:pt-0 last:pb-0" key={trip.id}>
                  <Link className="font-semibold text-[color:var(--pine)] hover:text-[color:var(--clay)]" href={articleHref(trip)}>
                    {trip.title}
                  </Link>
                  <p className="travel-muted mt-1 text-sm">
                    {trip.city}, {trip.country}
                  </p>
                  <p className="travel-muted mt-2 text-sm leading-6">{trip.summary}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="travel-soft-panel rounded-[2rem] p-5 sm:p-7">
            <h2 className="travel-hand text-2xl font-semibold">{"\u6574\u7406\u9032\u5ea6 / Working Queue"}</h2>
            <ol className="mt-5 space-y-3">
              {[
                "\u5b8c\u5584\u7cbe\u9078\u904a\u8a18 / Refine featured journal",
                "\u88dc\u9f4a\u7167\u7247\u8207\u8aaa\u660e / Complete photos and captions",
                "\u540c\u6b65\u5730\u5716\u8207\u6642\u9593\u7dda / Sync map and timeline",
                "\u4fdd\u7559\u7db2\u9801\u7de8\u8f2f\u80fd\u529b / Keep browser editing ready",
              ].map((task, index) => (
                <li className="flex gap-3 text-sm" key={task}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[color:var(--clay)] text-xs font-semibold text-white">{index + 1}</span>
                  <span className="travel-muted pt-1">{task}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </main>
  );
}
