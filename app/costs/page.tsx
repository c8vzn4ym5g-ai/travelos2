import Link from "next/link";
import { readContent } from "@/lib/editable-store";
import type { Cost, CostCategory, CurrencyCode } from "@/lib/types";

export const dynamic = "force-dynamic";

type CategorySummary = {
  category: CostCategory;
  currency: CurrencyCode;
  total: number;
  count: number;
};

type CurrencySummary = {
  currency: CurrencyCode;
  total: number;
  count: number;
};

const categoryLabels: Record<CostCategory, string> = {
  attraction: "Attractions",
  flight: "Flights",
  food: "Food",
  hotel: "Hotels",
  insurance: "Insurance",
  other: "Other",
  shopping: "Shopping",
  transportation: "Transportation",
};

function formatMoney(amount: number, currency: CurrencyCode) {
  return new Intl.NumberFormat("en", {
    currency,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(amount);
}

function summarizeByCurrency(costs: Cost[]) {
  const summaries = new Map<CurrencyCode, CurrencySummary>();

  for (const cost of costs) {
    const existing = summaries.get(cost.currency);
    summaries.set(cost.currency, {
      currency: cost.currency,
      total: (existing?.total ?? 0) + cost.amount,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...summaries.values()].sort((first, second) => second.total - first.total);
}

function summarizeByCategory(costs: Cost[]) {
  const summaries = new Map<string, CategorySummary>();

  for (const cost of costs) {
    const key = `${cost.category}-${cost.currency}`;
    const existing = summaries.get(key);
    summaries.set(key, {
      category: cost.category,
      currency: cost.currency,
      total: (existing?.total ?? 0) + cost.amount,
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...summaries.values()].sort((first, second) => {
    const currencyOrder = first.currency.localeCompare(second.currency);
    return currencyOrder === 0 ? second.total - first.total : currencyOrder;
  });
}

export default async function CostsPage() {
  const { content } = await readContent();
  const trips = [...content.trips].sort((firstTrip, secondTrip) => secondTrip.startDate.localeCompare(firstTrip.startDate));
  const costs = trips.flatMap((trip) => trip.costs.map((cost) => ({ ...cost, trip })));
  const currencySummaries = summarizeByCurrency(costs);
  const categorySummaries = summarizeByCategory(costs);

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <div className="flex gap-3 text-sm">
              <Link className="font-medium text-zinc-700" href="/trips">
                Trips
              </Link>
              <Link className="font-medium text-zinc-700" href="/timeline">
                Timeline
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Cost summary</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Travel spend by category</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                A read-only analytics foundation for comparing trip costs by currency, category, date, and journey.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4 text-sm">
              <p className="text-zinc-500">Tracked cost items</p>
              <p className="mt-2 text-3xl font-semibold text-zinc-950">{costs.length}</p>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-10">
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-teal-700">Currency totals</p>
            <div className="mt-5 grid gap-3">
              {currencySummaries.map((summary) => (
                <article className="rounded-md bg-stone-50 p-4" key={summary.currency}>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-500">{summary.currency}</p>
                      <p className="mt-1 text-2xl font-semibold">{formatMoney(summary.total, summary.currency)}</p>
                    </div>
                    <p className="text-sm font-medium text-zinc-600">{summary.count} items</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-teal-700">Category totals</p>
            <div className="mt-5 space-y-4">
              {categorySummaries.map((summary) => (
                <article className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0" key={`${summary.category}-${summary.currency}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-950">{categoryLabels[summary.category]}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {summary.count} {summary.count === 1 ? "item" : "items"} / {summary.currency}
                      </p>
                    </div>
                    <p className="font-semibold text-zinc-950">{formatMoney(summary.total, summary.currency)}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-teal-700">Cost ledger</p>
          <h2 className="mt-2 text-2xl font-semibold">Recent tracked spend</h2>
          <div className="mt-6 space-y-4">
            {costs.map(({ trip, ...cost }) => (
              <article className="grid gap-3 border-b border-zinc-100 pb-4 last:border-0 last:pb-0 sm:grid-cols-[1fr_auto]" key={cost.id}>
                <div>
                  <Link className="font-medium text-zinc-950" href={`/trips/${trip.slug}`}>
                    {trip.title}
                  </Link>
                  <p className="mt-1 text-sm capitalize text-zinc-500">
                    {cost.category} / {cost.paidAt}
                    {cost.merchant ? ` / ${cost.merchant}` : ""}
                  </p>
                  {cost.notes ? <p className="mt-2 text-sm leading-6 text-zinc-600">{cost.notes}</p> : null}
                </div>
                <p className="font-semibold text-zinc-950">{formatMoney(cost.amount, cost.currency)}</p>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
