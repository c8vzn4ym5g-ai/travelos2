"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FamilyBackLink } from "@/app/family/family-back";
import { FamGlyph, FamIconWell } from "@/app/family/family-icons";
import { resolveFamilySession } from "@/lib/family-session";
import {
  FAMILY_TRIP_LEDE,
  FAMILY_TRIP_FOOTER,
  FAMILY_TRIP_TITLE,
  defaultTripDay,
  familyTripDay1,
  familyTripDays,
  familyTripReturn,
  formatTripDateLabel,
  formatTripMd,
  placeMarkLabel,
  taipeiCalendarDate,
  tripDayFromCalendarDate,
  type FamilyTripDay,
  type FamilyTripPlace,
  type MealMark,
  type PlaceKind,
  type WeekIcon,
} from "@/lib/family-trip";

function MealMarkIcon({ value }: { value: MealMark }) {
  if (value === "yes") {
    return (
      <span aria-label="有" className="fam-mark fam-mark-yes">
        <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
          <path d="M3.2 8.4 6.1 11.2 12.8 4.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
        </svg>
      </span>
    );
  }

  return (
    <span aria-label="沒有" className="fam-mark fam-mark-no">
      <svg fill="none" height="14" viewBox="0 0 16 16" width="14">
        <path d="M4.2 4.2 11.8 11.8" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
        <path d="M11.8 4.2 4.2 11.8" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" />
      </svg>
    </span>
  );
}

function MealPair({
  breakfast,
  breakfastNote,
  dinner,
  dinnerNote,
}: {
  breakfast: MealMark | null;
  breakfastNote?: string;
  dinner: MealMark | null;
  dinnerNote?: string;
}) {
  if (breakfast == null && dinner == null) {
    return null;
  }

  return (
    <div className="fam-meals">
      {breakfast != null ? (
        <span className="fam-meal">
          <span>早餐</span>
          <MealMarkIcon value={breakfast} />
          {breakfastNote ? <span className="fam-meal-note">{breakfastNote}</span> : null}
        </span>
      ) : null}
      {dinner != null ? (
        <span className="fam-meal">
          <span>晚餐</span>
          <MealMarkIcon value={dinner} />
          {dinnerNote ? <span className="fam-meal-note">{dinnerNote}</span> : null}
        </span>
      ) : null}
    </div>
  );
}

function WeekIcons({ icons }: { icons: WeekIcon[] }) {
  return (
    <span className="fam-week-icons">
      {icons.map((name) => (
        <span className="fam-week-glyph" key={name}>
          <FamGlyph name={name} size={16} />
        </span>
      ))}
    </span>
  );
}

function placeKindLabel(kind: PlaceKind) {
  if (kind === "main") {
    return "MAIN";
  }
  if (kind === "backup") {
    return "備案";
  }
  if (kind === "craft") {
    return "看";
  }
  if (kind === "coffee") {
    return "REC";
  }
  return "店";
}

function DayBanner({ item }: { item: FamilyTripDay }) {
  return (
    <header className="fam-day-banner">
      <span className="fam-day-dot">{item.day}</span>
      <div>
        <p className="fam-label">{formatTripDateLabel(item)}</p>
        <p className="fam-leg-name">{item.nameZh}</p>
        {item.nameJa ? <p className="fam-name-ja">{item.nameJa}</p> : null}
      </div>
    </header>
  );
}

function StayCard({ item }: { item: FamilyTripDay }) {
  const kind = item.icons.includes("hotel") ? "hotel" : "car";
  return (
    <article className="leg-card" data-kind={kind}>
      <div className="flex items-center gap-3">
        <FamIconWell name={kind === "hotel" ? "hotel" : "car"} well="blush" />
        <div>
          <p className="fam-label">住宿</p>
          <p className="fam-leg-name">{item.nameZh}</p>
          {item.nameJa ? <p className="fam-name-ja">{item.nameJa}</p> : null}
        </div>
      </div>
      <dl>
        {item.address ? (
          <div className="fam-kv">
            <dt>地址</dt>
            <dd>{item.address}</dd>
          </div>
        ) : null}
        {item.checkIn ? (
          <div className="fam-kv">
            <dt>入住</dt>
            <dd>{item.checkIn}</dd>
          </div>
        ) : null}
        {item.checkOut ? (
          <div className="fam-kv">
            <dt>退房</dt>
            <dd>{item.checkOut}</dd>
          </div>
        ) : null}
        {item.pay ? (
          <div className="fam-kv">
            <dt>付款</dt>
            <dd>{item.pay}</dd>
          </div>
        ) : null}
      </dl>
      <MealPair
        breakfast={item.breakfast}
        breakfastNote={item.breakfastNote}
        dinner={item.dinner}
        dinnerNote={item.dinnerNote}
      />
      {item.booking ? <p className="fam-ref">訂房號 {item.booking}</p> : null}
    </article>
  );
}

function PlaceCard({ place }: { place: FamilyTripPlace }) {
  return (
    <article className="fam-place">
      <div className="fam-place-head">
        <span className={`fam-sticker-chip fam-place-mark-${place.mark}`}>{placeMarkLabel(place.mark)}</span>
        <span className="fam-place-kind">{placeKindLabel(place.kind)}</span>
      </div>
      <p className="fam-leg-name">{place.name}</p>
      {place.nameJa ? <p className="fam-name-ja">{place.nameJa}</p> : null}
      <dl>
        <div className="fam-kv">
          <dt>地址</dt>
          <dd>
            <address>{place.address}</address>
          </dd>
        </div>
        <div className="fam-kv">
          <dt>電話</dt>
          <dd className="place-phone">{place.phone}</dd>
        </div>
        {place.hours ? (
          <div className="fam-kv">
            <dt>時間</dt>
            <dd>{place.hours}</dd>
          </div>
        ) : null}
        {place.email ? (
          <div className="fam-kv">
            <dt>信箱</dt>
            <dd>{place.email}</dd>
          </div>
        ) : null}
      </dl>
      {place.note ? <p className="fam-muted mt-2">{place.note}</p> : null}
    </article>
  );
}

export default function FamilyTripPage() {
  const router = useRouter();
  // Start open so the Worker HTML already has 去搭飛機 / JX316 / days 1–8.
  // Family PIN is off on Cloudflare unless TRAVELOS_REQUIRE_FAMILY_PIN=1.
  const [authenticated, setAuthenticated] = useState(true);
  const [redirecting, setRedirecting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const calendarToday = useMemo(() => taipeiCalendarDate(), []);
  const calendarDay = tripDayFromCalendarDate(calendarToday);
  const activeDay = selected ?? calendarDay ?? defaultTripDay();

  useEffect(() => {
    let cancelled = false;

    void resolveFamilySession().then((session) => {
      if (cancelled) {
        return;
      }
      if (session.allowed) {
        setAuthenticated(true);
        return;
      }
      setRedirecting(true);
      router.replace("/family");
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function jumpToDay(day: number) {
    setSelected(day);
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`trip-day-${day}`);
      if (!target) {
        return;
      }
      const strip = document.querySelector<HTMLElement>("[data-surface='family'] .fam-day-strip");
      const offset = (strip?.getBoundingClientRect().height ?? 96) + 8;
      const top = window.scrollY + target.getBoundingClientRect().top - offset;
      window.scrollTo({ behavior: "smooth", top: Math.max(0, top) });
    });
  }

  if (!authenticated) {
    return (
      <main className="fam-page">
        <div className="fam-splash">
          <div className="fam-splash-card">
            <p className="fam-label">{redirecting ? "正在返回家庭登入…" : "正在開啟行程…"}</p>
            <p className="fam-muted mt-3">
              {redirecting ? "行程使用同一個家庭密碼，不會另外開密碼表單。" : "家庭入口開啟中，不必先輸入密碼。"}
            </p>
          </div>
        </div>
      </main>
    );
  }

  const { car, flight, hotel } = familyTripDay1;

  return (
    <main className="fam-page">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <FamilyBackLink className="min-h-11" href="/family">
            ← 家庭入口
          </FamilyBackLink>
          <p className="fam-script">trip companion</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <h1 className="fam-title">{FAMILY_TRIP_TITLE}</h1>
            <span aria-hidden className="fam-doll" />
          </div>
          <p className="fam-lede">{FAMILY_TRIP_LEDE}</p>
        </div>
      </header>

      <nav aria-label="行程日期" className="fam-day-strip">
        <div className="fam-day-strip-inner">
          {familyTripDays.map((item) => {
            const isActive = item.day === activeDay;
            return (
              <button
                className={`fam-day-btn${isActive ? " is-active" : ""}`}
                key={item.date}
                onClick={() => jumpToDay(item.day)}
                type="button"
              >
                <span className="fam-day-dot">{item.day}</span>
                <span className="fam-day-date">{formatTripMd(item.date)}</span>
                <span className="fam-day-wk">{item.weekday}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <section className="fam-sheet fam-trip-week">
        <h2 className="fam-section">總表</h2>
        <span className="fam-en">Week</span>
        <ul className="fam-week-list mt-4">
          {familyTripDays.map((item) => {
            const isToday = item.day === calendarDay;
            const isActive = item.day === activeDay;
            return (
              <li key={item.date}>
                <button
                  className={`fam-week-row fam-week-${item.tone}${isToday ? " is-today" : ""}${isActive ? " is-active" : ""}`}
                  onClick={() => jumpToDay(item.day)}
                  type="button"
                >
                  <span className="fam-day-dot">{item.day}</span>
                  <span className="fam-week-copy">
                    <strong>{formatTripDateLabel(item)}</strong>
                    <span className="fam-week-name">{item.nameZh}</span>
                    {item.nameJa ? <span className="fam-name-ja">{item.nameJa}</span> : null}
                    {item.extra.map((line) => (
                      <span className="fam-week-extra" key={line}>
                        {line}
                      </span>
                    ))}
                    {item.pay ? <span className="fam-week-pay">{item.pay}</span> : null}
                  </span>
                  <span className="fam-week-side">
                    <WeekIcons icons={item.icons} />
                    <MealPair breakfast={item.breakfast} breakfastNote={item.breakfastNote} dinner={item.dinner} />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-label="九州地圖 1 到 8" className="fam-sheet">
        <h2 className="fam-section">地圖</h2>
        <span className="fam-en">Days 1–8</span>
        <div
          className="fam-map-slot mt-4"
          data-hotspots="/family/trip/hotspots.json"
          data-map-slot="kyushu-1-8"
        >
          <p className="fam-label">1–8 的本子地圖</p>
          <p className="fam-muted mt-2">美工會放九州圖。先點日子看當天。</p>
        </div>
      </section>

      <section className="fam-sheet">
        <h2 className="fam-section">表1</h2>
        <span className="fam-en">Days</span>
      </section>

      <section className="fam-sheet fam-trip-day1 fam-trip-day" id="trip-day-1">
        <DayBanner item={familyTripDays[0]} />
        <article className="today-card" id="trip-today">
          <div className="fam-today-head">
            <span className="fam-sticker-chip fam-sticker-honey">今天</span>
            <span className="fam-today-date">{familyTripDay1.dateLabel}</span>
          </div>
          <dl>
            <div className="fam-kv">
              <dt>下一步</dt>
              <dd>
                {familyTripDay1.next}
                <span className="fam-next-detail">{familyTripDay1.nextDetail}</span>
              </dd>
            </div>
          </dl>
        </article>

        <article className="leg-card" data-kind="flight">
          <div className="flex items-center gap-3">
            <FamIconWell name="plane" well="sky" />
            <div>
              <p className="fam-label">{flight.sticker}</p>
              <p className="fam-leg-name">{flight.number}</p>
            </div>
          </div>
          <dl>
            <div className="fam-kv">
              <dt>{flight.routeLabel}</dt>
              <dd>{flight.route}</dd>
            </div>
            <div className="fam-kv">
              <dt>時間</dt>
              <dd>{flight.time}</dd>
            </div>
            <div className="fam-kv">
              <dt>訂位 PNR</dt>
              <dd>{flight.pnr}</dd>
            </div>
          </dl>
        </article>

        <article className="leg-card" data-kind="car">
          <div className="fam-car-head">
            <div className="flex items-center gap-3">
              <FamIconWell name="car" well="mint" />
              <div>
                <p className="fam-label">{car.sticker}</p>
                <p className="fam-leg-name">{car.name}</p>
              </div>
            </div>
            <img alt={car.photoAlt} className="fam-car-photo object-contain" src={car.photoSrc} />
          </div>
          <dl>
            <div className="fam-kv">
              <dt>取車</dt>
              <dd>{car.pickup}</dd>
            </div>
            <div className="fam-kv">
              <dt>還車</dt>
              <dd>{car.dropoff}</dd>
            </div>
          </dl>
          <p className="fam-car-access">{car.access}</p>
          <p className="fam-car-access-detail">{car.accessDetail}</p>
          <img alt={car.mapAlt} className="fam-kmj-map object-contain" src={car.mapSrc} />
          <p className="fam-ref">預約號 {car.reservation}</p>
        </article>

        <article className="leg-card" data-kind="hotel">
          <div className="flex items-center gap-3">
            <FamIconWell name="hotel" well="blush" />
            <div>
              <p className="fam-label">{hotel.sticker}</p>
              <p className="fam-leg-name">{hotel.nameZh}</p>
              <p className="fam-name-ja">{hotel.nameJa}</p>
            </div>
          </div>
          <dl>
            <div className="fam-kv">
              <dt>地址</dt>
              <dd>{hotel.address}</dd>
            </div>
            <div className="fam-kv">
              <dt>入住</dt>
              <dd>{hotel.checkIn}</dd>
            </div>
            <div className="fam-kv">
              <dt>退房</dt>
              <dd>{hotel.checkOut}</dd>
            </div>
          </dl>
          <MealPair breakfast={hotel.breakfast} dinner={hotel.dinner} />
          <dl>
            <div className="fam-kv">
              <dt>付款</dt>
              <dd>{hotel.pay}</dd>
            </div>
          </dl>
          <p className="fam-ref">訂房號 {hotel.booking}</p>
        </article>
        {familyTripDays[0].blurb.map((line) => (
          <p className="fam-muted" key={line}>
            {line}
          </p>
        ))}
      </section>

      {familyTripDays.slice(1).map((item) => (
        <section className="fam-sheet fam-trip-day" id={`trip-day-${item.day}`} key={item.date}>
          <DayBanner item={item} />
          {item.day === 8 ? (
            <>
              <article className="leg-card" data-kind="car">
                <div className="flex items-center gap-3">
                  <FamIconWell name="car" well="mint" />
                  <div>
                    <p className="fam-label">{car.sticker}</p>
                    <p className="fam-leg-name">{car.name}</p>
                  </div>
                </div>
                <dl>
                  <div className="fam-kv">
                    <dt>還車</dt>
                    <dd>{car.dropoff}</dd>
                  </div>
                </dl>
                <p className="fam-ref">預約號 {car.reservation}</p>
              </article>
              <article className="leg-card" data-kind="flight">
                <div className="flex items-center gap-3">
                  <FamIconWell name="plane" well="sky" />
                  <div>
                    <p className="fam-label">{familyTripReturn.flight.sticker}</p>
                    <p className="fam-leg-name">{familyTripReturn.flight.number}</p>
                  </div>
                </div>
                <dl>
                  <div className="fam-kv">
                    <dt>{familyTripReturn.flight.routeLabel}</dt>
                    <dd>{familyTripReturn.flight.route}</dd>
                  </div>
                  <div className="fam-kv">
                    <dt>時間</dt>
                    <dd>{familyTripReturn.flight.time}</dd>
                  </div>
                  <div className="fam-kv">
                    <dt>訂位 PNR</dt>
                    <dd>{familyTripReturn.flight.pnr}</dd>
                  </div>
                </dl>
              </article>
            </>
          ) : (
            <StayCard item={item} />
          )}
          {item.blurb.map((line) => (
            <p className="fam-muted" key={line}>
              {line}
            </p>
          ))}
          {item.places.map((place) => (
            <PlaceCard key={`${place.name}-${place.address}`} place={place} />
          ))}
        </section>
      ))}

      <p className="fam-trip-footer fam-sheet">{FAMILY_TRIP_FOOTER}</p>
    </main>
  );
}
