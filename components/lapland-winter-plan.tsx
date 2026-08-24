import Link from "next/link";
import { AffiliateDisclosure } from "@/components/affiliate-disclosure";

const planNotes = [
  {
    bodyZh:
      "從亞洲出發，常見走法是先飛赫爾辛基（HEL），再轉羅瓦涅米（RVN）。直飛羅瓦涅米則把第一晚放在雪裡。本篇於 1 月 18 日抵達。",
    bodyEn:
      "From Asia, a common route is Helsinki (HEL), then a connecting flight to Rovaniemi (RVN). A flight into Rovaniemi puts the first night in the snow. This journal arrived on 18 January.",
    title: "航班 / Flights",
  },
  {
    bodyZh: "聖誕老人村附近方便白天走到北極圈標記、木屋與雪徑。雪屋更靜，適合營火與落雪的夜晚。",
    bodyEn:
      "A stay near Santa Claus Village makes daytime walks to the Arctic Circle marker, timber houses, and snow paths easy. A snow cabin is quieter for campfire and snowfall nights.",
    title: "住宿 / Stays",
  },
  {
    bodyZh: "羅瓦涅米可作單日短程：聖誕老人村、北極圈線、雪橇，再回到鎮上或小屋。不必每天換住宿。",
    bodyEn:
      "From Rovaniemi, day trips cover Santa Claus Village, the Arctic Circle line, and sledding, then return to town or the cabin. You do not need to change lodging every day.",
    title: "北極圈日間行程 / Arctic Circle day trips",
  },
];

export function LaplandWinterPlan() {
  return (
    <section className="travel-panel rounded-3xl p-5 sm:p-7" data-plan-winter="" id="plan-winter">
      <p className="travel-kicker text-xs">Plan a winter like this</p>
      <h2 className="travel-hand mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">
        策劃這樣的冬旅 / Plan a winter like this
      </h2>
      <p className="travel-muted mt-4 text-base leading-8">
        這篇遊記以羅瓦涅米為基地。若要走一條相近的冬旅，先選定入境城市，再決定住在聖誕老人村附近或一間雪屋。
      </p>
      <p className="travel-muted mt-3 text-base leading-8">
        This journal is based in Rovaniemi. For a winter like this, choose the arrival city first, then a stay near Santa
        Claus Village or a snow cabin.
      </p>
      <div className="mt-6 grid gap-5">
        {planNotes.map((note) => (
          <article key={note.title}>
            <h3 className="font-semibold text-[color:var(--ink)]">{note.title}</h3>
            <p className="travel-muted mt-2 text-sm leading-7">{note.bodyZh}</p>
            <p className="travel-muted mt-2 text-sm leading-7">{note.bodyEn}</p>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-[color:var(--line)] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--pine)]"
          href="/drive"
        >
          打開策劃頁 / Open Plan & Book
        </Link>
      </div>
      <AffiliateDisclosure className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950" />
    </section>
  );
}
