import type { Cost, Money } from "@/lib/types";
import {
  GO_THERE_HREF,
  GO_THERE_LABEL,
  JOURNAL_COST_CHIP_LABEL,
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

const costChipTone = "border-teal-100 bg-teal-50 text-teal-950";

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

function JournalCostFootnote({ slug, variant }: { slug: string; variant: "chip" | "spend" }) {
  const isLapland = isLaplandJournalSlug(slug);
  const introZh = isLapland ? LAPLAND_JOURNAL_COST_ZH : JOURNAL_COST_GENERIC_ZH;
  const introEn = isLapland ? LAPLAND_JOURNAL_COST_EN : JOURNAL_COST_GENERIC_EN;
  const rangeZh = isLapland ? (variant === "spend" ? LAPLAND_COST_ASIDE_2026_ZH : LAPLAND_COST_HERO_2026_ZH) : null;
  const rangeEn = isLapland ? (variant === "spend" ? LAPLAND_COST_ASIDE_2026_EN : LAPLAND_COST_HERO_2026_EN) : null;

  return (
    <div className="space-y-1.5 text-xs leading-5 text-[color:var(--muted)]" data-journal-cost-note={isLapland ? "lapland" : ""}>
      <p>{introZh}</p>
      <p>{introEn}</p>
      {rangeZh ? <p>{rangeZh}</p> : null}
      {rangeEn ? <p>{rangeEn}</p> : null}
      {isLapland ? (
        <p>
          <GoThereLink /> {LAPLAND_COST_GO_THERE_ZH} / {LAPLAND_COST_GO_THERE_EN}
        </p>
      ) : null}
    </div>
  );
}

export function JournalCostChip({ amount, slug }: { amount: string; slug: string }) {
  return (
    <details className="journal-cost-chip max-w-xl" data-journal-cost-chip="">
      <summary className={`inline-flex items-center rounded-full border px-3 py-2 text-sm shadow-sm ${costChipTone}`}>
        <span className="travel-kicker mr-2 text-[0.65rem]">{JOURNAL_COST_CHIP_LABEL}</span>
        <span className="font-semibold">{amount}</span>
        <span aria-hidden="true" className="ml-1.5 text-[0.65rem] text-teal-800/70">
          ▾
        </span>
      </summary>
      <div className="mt-2 px-1">
        <JournalCostFootnote slug={slug} variant="chip" />
      </div>
    </details>
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
  return (
    <section className="travel-panel rounded-2xl p-4" data-journal-spend="">
      <div>
        <p className="travel-kicker text-xs">Costs</p>
        <h2 className="travel-hand mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">
          {journalSpendTitle(startDate)}
        </h2>
      </div>
      {totalCost ? (
        <p className="mt-3 text-sm font-semibold text-[color:var(--ink)]">
          {journalCostTotalLabel(startDate, totalCost)}
        </p>
      ) : null}
      <details className="journal-cost-notes mt-3" data-lapland-cost-2026={isLaplandJournalSlug(slug) ? "" : undefined}>
        <summary className="travel-muted text-xs leading-5">花費備註 / Price notes</summary>
        <div className="mt-2">
          <JournalCostFootnote slug={slug} variant="spend" />
        </div>
      </details>
      <div className="mt-4">
        {costs.map((cost) => (
          <CostRow cost={cost} key={cost.id} />
        ))}
      </div>
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
