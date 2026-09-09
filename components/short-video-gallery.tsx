import type { PromoVideo } from "@/lib/promo-videos";

export function ShortVideoGallery({ videos }: { videos: PromoVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <section className="travel-panel rounded-3xl p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="travel-kicker text-xs">Short video</p>
          <h2 className="travel-hand mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">宣傳短片草稿</h2>
        </div>
        <span className="travel-chip rounded-full px-3 py-2 text-xs font-semibold">無旁白・文字＋配樂</span>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {videos.map((video) => (
          <article className="travel-soft-panel overflow-hidden rounded-3xl" key={video.src}>
            <video className="aspect-[9/16] w-full bg-black object-cover" controls playsInline preload="metadata">
              <source src={video.src} type="video/mp4" />
            </video>
            <div className="p-4">
              <h3 className="font-semibold text-[color:var(--ink)]">{video.title}</h3>
              <p className="travel-muted mt-2 text-sm leading-6">{video.caption}</p>
              <p className="travel-kicker mt-3 text-xs">{video.mood}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

