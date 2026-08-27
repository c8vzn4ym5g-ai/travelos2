import {
  LAPLAND_STOREFRONT_EN,
  LAPLAND_STOREFRONT_KICKER,
  LAPLAND_STOREFRONT_TITLE,
  LAPLAND_STOREFRONT_ZH,
} from "@/lib/lapland-storefront-copy";

export function LaplandStorefrontGlance() {
  return (
    <section
      aria-label={LAPLAND_STOREFRONT_TITLE}
      className="max-w-4xl scroll-mt-24"
      data-storefront-glance=""
      id="why-go"
    >
      <p className="travel-kicker text-xs">{LAPLAND_STOREFRONT_KICKER}</p>
      <h2 className="travel-hand mt-2 text-2xl font-semibold leading-tight text-[color:var(--ink)] sm:text-3xl">
        {LAPLAND_STOREFRONT_TITLE}
      </h2>
      {LAPLAND_STOREFRONT_ZH.split("\n\n").map((paragraph) => (
        <p className="travel-muted mt-3 text-base leading-8" key={paragraph}>
          {paragraph}
        </p>
      ))}
      {LAPLAND_STOREFRONT_EN.split("\n\n").map((paragraph) => (
        <p className="travel-muted mt-2 text-base leading-8" key={paragraph}>
          {paragraph}
        </p>
      ))}
    </section>
  );
}
