import Link from "next/link";

const bookingAreas = [
  {
    title: "Flights / 航班",
    description: "使用獨立的航班合作計畫；不把 Klook 的排除類別誤算成航班收益。",
    status: "Next: search form",
  },
  {
    title: "Stays / 住宿",
    description: "把飯店工具放在真正談住宿、地區與行程選擇的內容旁邊。",
    status: "Next: hotel module",
  },
  {
    title: "Things to do / 活動",
    description: "Klook、Tiqets、KKday 等計畫應隨目的地內容出現，而不是塞滿首頁。",
    status: "Content-linked",
  },
  {
    title: "Transport / 當地交通",
    description: "租車、機場接送、火車與巴士各用適合的合作計畫與追蹤位置。",
    status: "Content-linked",
  },
];

export default function DrivePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
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
              Useful travel tools, placed where they belong.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
              TravelOS first helps readers understand a place. Relevant flight, stay, activity, and transport tools can then help
              them act on that information without interrupting the story.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="grid gap-4 md:grid-cols-2">
          {bookingAreas.map((area) => (
            <article className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm" key={area.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-700">{area.status}</p>
              <h2 className="mt-2 text-xl font-semibold">{area.title}</h2>
              <p className="mt-3 text-sm leading-6 text-zinc-600">{area.description}</p>
            </article>
          ))}
        </div>
        <aside className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <h2 className="font-semibold">聯盟連結揭露 / Affiliate disclosure</h2>
          <p className="mt-2">
            TravelOS 使用 Travelpayouts Drive 協助辨識適合的旅遊服務連結。部分連結可能是聯盟連結；若讀者完成合資格預訂，
            TravelOS 可能獲得收益，讀者的價格不會因此增加。
          </p>
          <p className="mt-2">
            Drive 不是租車搜尋器；它是全站的智慧聯盟連結層。真正的航班、住宿與活動搜尋元件會分開接入並逐一驗證。
          </p>
        </aside>
      </section>
    </main>
  );
}
