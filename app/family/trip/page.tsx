"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FamGlyph, FamIconWell } from "@/app/family/family-icons";
import { resolveFamilySession } from "@/lib/family-session";
import {
  FAMILY_TRIP_LEDE,
  FAMILY_TRIP_FOOTER,
  FAMILY_TRIP_TITLE,
  defaultTripDay,
  familyTripDay1,
  familyTripDays,
  formatTripDateLabel,
  formatTripMd,
  taipeiCalendarDate,
  tripDayFromCalendarDate,
  type MealMark,
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
}: {
  breakfast: MealMark | null;
  breakfastNote?: string;
  dinner: MealMark | null;
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
    const target = document.getElementById(day === 1 ? "trip-today" : `trip-day-${day}`);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
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
          <Link className="fam-back min-h-11" href="/family">
            ← 家庭入口
          </Link>
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

      <section className="fam-sheet fam-trip-day1">
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
      </section>

      <section className="fam-sheet fam-trip-week">
        <ul className="fam-week-list">
          {familyTripDays.map((item) => {
            const isToday = item.day === calendarDay;
            const isActive = item.day === activeDay;
            return (
              <li id={`trip-day-${item.day}`} key={item.date}>
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
        <p className="fam-trip-footer">{FAMILY_TRIP_FOOTER}</p>
      </section>
    </main>
  );
}
