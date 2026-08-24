import { AffiliateDisclosure } from "@/components/affiliate-disclosure";
import {
  AVIASALES_SEARCH_URL,
  HOTELLOOK_SEARCH_URL,
  klookActivitiesUrl,
  type BookingDestination,
} from "@/lib/travelpayouts";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[color:var(--line)] bg-white px-3 text-sm text-[color:var(--ink)]";
const labelClass = "travel-kicker text-[0.65rem]";
const submitClass =
  "inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[color:var(--pine)] px-4 text-sm font-semibold text-white";

export function BookingBand({ destination }: { destination: BookingDestination }) {
  const activitiesHref = klookActivitiesUrl(destination.activitiesQuery);

  return (
    <section className="travel-panel rounded-3xl p-5 sm:p-7" data-booking-band="" id="go-there">
      <p className="travel-kicker text-xs">Go there</p>
      <h2 className="travel-hand mt-2 text-2xl font-semibold text-[color:var(--ink)] sm:text-3xl">出發 / Go there</h2>
      <p className="travel-muted mt-3 text-sm leading-7">
        從香港（HKG）飛入羅瓦涅米（RVN）或赫爾辛基（HEL）。住宿以羅瓦涅米為底，方便聖誕老人村與北極圈日間行程。
      </p>
      <p className="travel-muted mt-2 text-sm leading-7">
        Fly from Hong Kong (HKG) into Rovaniemi (RVN) or Helsinki (HEL). Stay in Rovaniemi for Santa Claus Village and
        Arctic Circle day trips.
      </p>

      <div className="mt-6 grid gap-5">
        <article className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
          <h3 className="font-semibold text-[color:var(--ink)]">航班 / Flights</h3>
          <p className="travel-muted mt-1 text-sm leading-6">Aviasales · {destination.originIata} → {destination.destinationIata} or {destination.extraIata}</p>
          <form action={AVIASALES_SEARCH_URL} className="mt-4 grid gap-3" method="get" rel="noopener noreferrer" target="_blank">
            <label className="grid gap-1">
              <span className={labelClass}>From / 出發</span>
              <input className={fieldClass} defaultValue={destination.originIata} name="origin_iata" />
            </label>
            <label className="grid gap-1">
              <span className={labelClass}>To / 抵達</span>
              <select className={fieldClass} defaultValue={destination.destinationIata} name="destination_iata">
                <option value={destination.destinationIata}>
                  {destination.city} ({destination.destinationIata})
                </option>
                <option value={destination.extraIata}>Helsinki ({destination.extraIata})</option>
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className={labelClass}>Depart / 去程</span>
                <input className={fieldClass} defaultValue={destination.defaultDepartDate} name="depart_date" type="date" />
              </label>
              <label className="grid gap-1">
                <span className={labelClass}>Return / 回程</span>
                <input className={fieldClass} defaultValue={destination.defaultReturnDate} name="return_date" type="date" />
              </label>
            </div>
            <button className={submitClass} type="submit">
              搜尋航班 / Search flights
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
          <h3 className="font-semibold text-[color:var(--ink)]">住宿 / Stays</h3>
          <p className="travel-muted mt-1 text-sm leading-6">Hotellook · {destination.city}</p>
          <form action={HOTELLOOK_SEARCH_URL} className="mt-4 grid gap-3" method="get" rel="noopener noreferrer" target="_blank">
            <label className="grid gap-1">
              <span className={labelClass}>City / 城市</span>
              <input className={fieldClass} defaultValue={destination.city} name="destination" />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className={labelClass}>Check-in</span>
                <input className={fieldClass} defaultValue={destination.defaultDepartDate} name="checkIn" type="date" />
              </label>
              <label className="grid gap-1">
                <span className={labelClass}>Check-out</span>
                <input className={fieldClass} defaultValue={destination.defaultReturnDate} name="checkOut" type="date" />
              </label>
            </div>
            <button className={submitClass} type="submit">
              搜尋住宿 / Search stays
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-[color:var(--line)] bg-white/70 p-4">
          <h3 className="font-semibold text-[color:var(--ink)]">活動 / Things to do</h3>
          <p className="travel-muted mt-1 text-sm leading-6">Klook · {destination.city}, {destination.country}</p>
          <a
            className={`${submitClass} mt-4`}
            href={activitiesHref}
            rel="noopener noreferrer"
            target="_blank"
          >
            羅瓦涅米活動 / Things to do in {destination.city}
          </a>
        </article>
      </div>

      <AffiliateDisclosure className="mt-6" />
    </section>
  );
}
