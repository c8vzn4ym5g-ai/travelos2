import Link from "next/link";

const sections = [
  {
    accent: "border-sky-200 bg-sky-50",
    description: "查看 Bangkok、Lapland 和之後新增的旅行；進入編輯區可增減遊記、文字與照片。",
    editHref: "/trips/admin",
    editLabel: "編輯旅行內容",
    title: "旅行遊記",
    viewHref: "/trips",
    viewLabel: "查看全部旅行",
  },
  {
    accent: "border-rose-200 bg-rose-50",
    description: "查看咖啡店、生活筆記與照片；進入編輯區可新增、修改、排序或刪除內容。",
    editHref: "/coffee/admin",
    editLabel: "編輯咖啡內容",
    title: "咖啡記憶",
    viewHref: "/coffee",
    viewLabel: "查看咖啡地圖",
  },
];

export default function FamilyWorkspacePage() {
  return (
    <main className="travel-body min-h-screen bg-[#f8f3ea] text-zinc-950">
      <section className="border-b border-emerald-100 bg-[radial-gradient(circle_at_top_left,_#d1fae5_0,_transparent_34%),linear-gradient(180deg,_#fffdf7_0%,_#f8f3ea_100%)]">
        <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
          <Link className="travel-label inline-flex min-h-11 items-center text-sm font-semibold text-emerald-800" href="/">
            ← TravelOS 首頁
          </Link>
          <p className="travel-script mt-8 text-2xl text-rose-700">our family workspace</p>
          <h1 className="travel-display mt-2 text-4xl font-semibold sm:text-6xl">家庭編輯</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-600">
            Jason 與 Sana 都可以查看、增加、修改彼此的旅行、咖啡與照片。每次修改保留作者與版本，內容可以復原。
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-6 py-8 lg:grid-cols-2 lg:px-10">
        {sections.map((section) => (
          <article className={`rounded-3xl border p-6 shadow-sm ${section.accent}`} key={section.title}>
            <h2 className="travel-display text-3xl font-semibold">{section.title}</h2>
            <p className="mt-3 min-h-20 text-sm leading-6 text-zinc-600">{section.description}</p>
            <div className="mt-6 grid gap-3">
              <Link className="rounded-2xl border border-white bg-white px-4 py-3 text-center font-semibold shadow-sm" href={section.viewHref}>
                {section.viewLabel}
              </Link>
              <Link className="rounded-2xl bg-zinc-950 px-4 py-3 text-center font-semibold text-white" href={section.editHref}>
                {section.editLabel}
              </Link>
            </div>
          </article>
        ))}
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-6 pb-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6">
          <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-amber-800">請 JDB 幫忙</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">傳照片、想法或修改要求</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            需要 Codex 整理照片、潤飾遊記或協助寫作時，直接送進 JDB Sana；完成後會回到家庭收件箱。
          </p>
          <a
            className="mt-5 block rounded-2xl bg-emerald-800 px-4 py-3 text-center font-semibold text-white"
            href="https://jdb-family-entry.exact-flute-2594.chatgpt.site/"
          >
            開啟 JDB Sana
          </a>
        </article>

        <article className="rounded-3xl border border-stone-200 bg-white p-6">
          <p className="travel-label text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">安裝到 iPhone</p>
          <h2 className="travel-display mt-2 text-2xl font-semibold">只需要設定一次</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-zinc-600">
            <li>1. 用 Safari 開啟 TravelOS。</li>
            <li>2. 點分享按鈕。</li>
            <li>3. 選「加入主畫面」。</li>
            <li>4. 以後點 TravelOS 圖示直接進入。</li>
          </ol>
        </article>
      </section>
    </main>
  );
}
