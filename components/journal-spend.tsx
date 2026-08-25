import type { Cost, Money } from "@/lib/types";
import {
  GO_THERE_HREF,
  GO_THERE_LABEL,
  JOURNAL_COST_GENERIC_EN,
  JOURNAL_COST_GENERIC_ZH,
  LAPLAND_COST_ASIDE_2026_EN,
  LAPLAND_COST_ASIDE_2026_ZH,
  LAPLAND_COST_GO_THERE_EN,
  LAPLAND_COST_GO_THERE_ZH,
  LAPLAND_COST_HERO_2026_EN,
  LAPLAND_COST_HERO_2026_ZH,
  LAPLAND_JOURNAL_COST_EN,
  LAPLAND_JOURNAL_COST_ZH,
  isLaplandJournalSlug,
  journalLineRecordLabel,
  journalSpendTitle,
  journalYearFromDate,
} from "@/lib/journal-cost-copy";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(date: string): string {
  return dateFormatter.format(new Date(date));
}

function formatCost(cost: Cost): string {
  return new Intl.NumberFormat("en", {
    currency: cost.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cost.amount);
}

function GoThereLink() {
  return (
    <a className="font-semibold text-[color:var(--pine)] underline-offset-2 hover:underline" href={GO_THERE_HREF}>
      {GO_THERE_LABEL}
    </a>
  );
}

function CostRow({ cost }: { cost: Cost }) {
  return (
    <article className="grid gap-2 border-b border-[color:var(--line)] py-4 text-sm first:pt-0 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]">
      <div>
        <p className="font-semibold capitalize text-[color:var(--ink)]">{cost.category}</p>
        <p className="travel-muted mt-1">
          {formatDate(cost.paidAt)}
          {cost.merchant ? ` / ${cost.merchant}` : ""}
        </p>
        {cost.notes ? <p className="travel-muted mt-2 leading-6">{cost.notes}</p> : null}
      </div>
      <div className="sm:text-right">
        <p className="font-semibold text-[color:var(--pine)]">{formatCost(cost)}</p>
        <p className="travel-kicker mt-1 text-[0.65rem]">{journalLineRecordLabel(cost.paidAt)}</p>
      </div>
    </article>
  );
}

export function JournalCostHeroNote({
  hasCost,
  slug,
}: {
  hasCost: boolean;
  slug: string;
}) {
  if (!hasCost) {
    return null;
  }

  if (!isLaplandJournalSlug(slug)) {
    return (
      <p className="travel-muted max-w-3xl text-sm leading-6" data-journal-cost-note="">
        {JOURNAL_COST_GENERIC_ZH} / {JOURNAL_COST_GENERIC_EN}
      </p>
    );
  }

  return (
    <div className="max-w-3xl space-y-2" data-journal-cost-note="lapland">
      <p className="travel-muted text-sm leading-6">{LAPLAND_JOURNAL_COST_ZH}</p>
      <p className="travel-muted text-sm leading-6">{LAPLAND_JOURNAL_COST_EN}</p>
      <p className="travel-muted text-sm leading-6">{LAPLAND_COST_HERO_2026_ZH}</p>
      <p className="travel-muted text-sm leading-6">{LAPLAND_COST_HERO_2026_EN}</p>
      <p className="text-sm leading-6 text-[color:var(--ink)]">
        <GoThereLink /> {LAPLAND_COST_GO_THERE_ZH} / {LAPLAND_COST_GO_THERE_EN}
      </p>
    </div>
  );
}

export function JournalSpendPanel({
  costs,
  slug,
  startDate,
  totalCost,
}: {
  costs: Cost[];
  slug: string;
  startDate: string;
  totalCost: Money | null;
}) {
  const isLapland = isLaplandJournalSlug(slug);
  const introZh = isLapland ? LAPLAND_JOURNAL_COST_ZH : JOURNAL_COST_GENERIC_ZH;
  const introEn = isLapland ? LAPLAND_JOURNAL_COST_EN : JOURNAL_COST_GENERIC_EN;

  return (
    <section className="travel-panel rounded-2xl p-4" data-journal-spend="">
      <div>
        <p className="travel-kicker text-xs">Costs</p>
        <h2 className="travel-hand mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">
          {journalSpendTitle(startDate)}
        </h2>
      </div>
      <p className="travel-muted mt-3 text-sm leading-6">{introZh}</p>
      <p className="travel-muted mt-1 text-sm leading-6">{introEn}</p>
      {totalCost ? (
        <p className="mt-3 text-sm font-semibold text-[color:var(--ink)]">
          {journalCostTotalLabel(startDate, totalCost)}
        </p>
      ) : null}
      <div className="mt-4">
        {costs.map((cost) => (
          <CostRow cost={cost} key={cost.id} />
        ))}
      </div>
      {isLapland ? (
        <div className="mt-4 space-y-2 rounded-2xl border border-[color:var(--line)] bg-white/70 p-3" data-lapland-cost-2026="">
          <p className="travel-kicker text-[0.65rem]">2026 August reference</p>
          <p className="travel-muted text-sm leading-6">{LAPLAND_COST_ASIDE_2026_ZH}</p>
          <p className="travel-muted text-sm leading-6">{LAPLAND_COST_ASIDE_2026_EN}</p>
          <p className="text-sm leading-6 text-[color:var(--ink)]">
            <GoThereLink /> {LAPLAND_COST_GO_THERE_ZH} / {LAPLAND_COST_GO_THERE_EN}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function journalCostTotalLabel(startDate: string, totalCost: Money): string {
  const formatted = new Intl.NumberFormat("en", {
    currency: totalCost.currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(totalCost.amount);

  return `${journalYearFromDate(startDate)} 遊記合計 / Journal total ${formatted}`;
}
