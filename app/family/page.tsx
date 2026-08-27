import Link from "next/link";
import { FamilyUnlockPanel } from "./family-unlock-panel";

const departments = [
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

const doorClass =
  "flex min-h-12 items-center justify-center rounded-2xl border px-4 py-3 text-center font-semibold shadow-sm";

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

      <FamilyUnlockPanel />

      <section className="mx-auto max-w-5xl px-6 pt-8 lg:px-10">
        <article className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
          <h2 className="travel-display text-3xl font-semibold">入口</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Link className={`${doorClass} border-emerald-300 bg-emerald-50 text-emerald-950`} href="/family/capture">
              Capture
            </Link>
            <Link className={`${doorClass} border-sky-300 bg-sky-50 text-sky-950`} href="/trips/write">
              Write
            </Link>
          </div>
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-5 lg:px-10">
        <article className="rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
          <h2 className="travel-display text-3xl font-semibold">工作台</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-600">剛收下的，還沒整理。旅行和咖啡都還沒進。</p>
          <Link className={`${doorClass} mt-6 border-white bg-white text-amber-950`} href="/family/bench">
            打開
          </Link>
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-6 pt-5 lg:px-10">
        <h2 className="travel-display text-3xl font-semibold">編輯</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {departments.map((department) => (
            <article className={`rounded-3xl border p-6 shadow-sm ${department.accent}`} key={department.title}>
              <h3 className="travel-display text-3xl font-semibold">{department.title}</h3>
              <p className="mt-3 min-h-20 text-sm leading-6 text-zinc-600">{department.description}</p>
              <div className="mt-6 grid gap-3">
                <Link className={`${doorClass} border-white bg-white`} href={department.viewHref}>
                  {department.viewLabel}
                </Link>
                <Link className={`${doorClass} border-emerald-300 bg-emerald-50 text-emerald-950`} href={department.editHref}>
                  {department.editLabel}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
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
