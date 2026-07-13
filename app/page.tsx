import Link from "next/link";

const stats = [
  { label: "Featured / 精選旅程", value: "Lapland" },
  { label: "Days / 旅行日數", value: "8" },
  { label: "Photos / 影像記憶", value: "10" },
  { label: "Stops / 收藏座標", value: "3" },
];

const journeys = [
  {
    place: "羅瓦涅米，芬蘭 / Rovaniemi, Finland",
    date: "2020 冬季 / Winter 2020",
    note: "聖誕老人村、北極圈雪地、木屋夜晚與雪橇路線。 / Santa Claus Village, Arctic Circle snow, cabin evenings, and sled rides.",
  },
  {
    place: "北海道，日本 / Hokkaido, Japan",
    date: "2025 秋季 / Autumn 2025",
    note: "海鮮市場、溫泉與更緩慢的北方路線。 / Seafood, hot springs, and a slower northern route.",
  },
  {
    place: "曼谷，泰國 / Bangkok, Thailand",
    date: "2025 春季 / Spring 2025",
    note: "食物筆記、酒店觀察、市場清晨與短途旅行。 / Food notes, hotel reviews, markets, and day trips.",
  },
];

const tasks = [
  "整理拉普蘭冬日記憶 / Refine Lapland winter journal",
  "補完照片與說明 / Complete photos and captions",
  "同步地圖與時間線 / Sync map and timeline",
  "保留後續可編輯入口 / Keep browser editing ready",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-8 lg:px-10">
          <nav className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">TravelOS</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
                拉普蘭冬日記憶
                <span className="block text-2xl text-zinc-500 sm:text-3xl">Lapland Winter Journal</span>
              </h1>
            </div>
            <div className="hidden gap-2 sm:flex">
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/map">
                Map / 地圖
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/timeline">
                Timeline / 時間線
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/costs">
                Costs / 花費
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/assistant">
                Assistant / 助理
              </Link>
              <Link className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white" href="/admin">
                Edit / 編輯
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/trips/new">
                New / 新增
              </Link>
              <Link className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white" href="/trips">
                Trips / 旅程
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">拉普蘭旅程看板 / Lapland Journey Board</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
                從羅瓦涅米的冬日路線開始，打開完整文章，閱讀聖誕老人村、北極圈、雪地木屋與篝火記憶。
                <span className="mt-2 block">
                  Start with the Rovaniemi winter route, then open the full article for snow village photos, Arctic Circle notes, costs, and saved stops.
                </span>
              </p>
            </div>
            <Link className="rounded-md bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800" href="/map">
              Open map / 打開地圖
            </Link>
          </div>
          <div className="mt-8 grid min-h-[320px] gap-3 rounded-lg border border-zinc-200 bg-stone-100 p-3 sm:grid-cols-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt="夜色中的聖誕老人村 / Santa Claus Village glowing in Lapland winter night"
              className="h-full min-h-[320px] w-full rounded-md object-cover sm:col-span-2"
              src="/travelos/lapland/santa-village-night.jpeg"
            />
            <div className="grid gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="北極圈雪地標記 / Arctic Circle snow marker" className="h-40 w-full rounded-md object-cover" src="/travelos/lapland/arctic-circle.jpeg" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt="拉普蘭雪地篝火 / Campfire in Lapland snow" className="h-40 w-full rounded-md object-cover" src="/travelos/lapland/campfire.jpeg" />
            </div>
          </div>
        </div>
        <aside className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">最新旅程 / Latest Journeys</h2>
            <div className="mt-5 space-y-4">
              {journeys.map((journey) => (
                <article className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0" key={journey.place}>
                  <p className="font-medium">{journey.place}</p>
                  <p className="mt-1 text-sm text-zinc-500">{journey.date}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{journey.note}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">整理進度 / Working Queue</h2>
            <ol className="mt-5 space-y-3">
              {tasks.map((task, index) => (
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
