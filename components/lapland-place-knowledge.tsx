import { LAPLAND_PLACE_KNOWLEDGE } from "@/lib/lapland-storefront-copy";

export function LaplandPlaceKnowledge() {
  return (
    <section aria-label="Place knowledge" className="max-w-4xl" data-place-knowledge="">
      <p className="travel-kicker text-xs">場所知識 / Place knowledge</p>
      <h2 className="travel-hand mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)] sm:text-3xl">
        不是日記裡的多出來的一天 / Not an extra day in the journal
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {LAPLAND_PLACE_KNOWLEDGE.map((fact) => (
          <article className="travel-soft-panel rounded-2xl p-4" key={fact.title}>
            <h3 className="text-sm font-semibold leading-6 text-[color:var(--ink)]">{fact.title}</h3>
            <p className="travel-muted mt-2 text-sm leading-6">{fact.zh}</p>
            <p className="travel-muted mt-1 text-sm leading-6">{fact.en}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
