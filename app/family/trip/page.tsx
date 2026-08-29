"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FamIconWell } from "@/app/family/family-icons";
import { resolveFamilySession } from "@/lib/family-session";
import {
  defaultTripDay,
  FAMILY_TRIP_TITLE,
  familyTripCarry,
  familyTripDays,
  formatTripMd,
  taipeiCalendarDate,
  tripDayFromCalendarDate,
  type Breakfast,
  type FamilyTripDay,
  type HotelLeg,
  type TripLeg,
  type TripRef,
} from "@/lib/family-trip";

function BreakfastChips({ value }: { value: Breakfast }) {
  return (
    <span className="fam-breakfast">
      <span className={value === "yes" ? "is-on" : undefined}>有</span>
      <span className={value === "no" ? "is-on" : undefined}>沒有</span>
    </span>
  );
}

function Refs({ label, refs }: { label?: string; refs: TripRef[] }) {
  if (refs.length === 0) {
    return null;
  }
  return (
    <div>
      {label ? <span className="fam-ref">{label}</span> : null}
      {refs.map((ref) => (
        <span className="fam-ref" key={`${ref.label}-${ref.value}`}>
          {ref.label} {ref.value}
        </span>
      ))}
    </div>
  );
}

function HotelClock({ letter, official }: { letter: string; official: string }) {
  return (
    <dd>
      <span>信 {letter}</span>
      {official ? <span className="fam-clock-official">官網 {official}</span> : null}
    </dd>
  );
}

function HotelFields({ leg }: { leg: HotelLeg }) {
  if (leg.compact) {
    return (
      <dl>
        <div className="fam-kv">
          <dt>退房</dt>
          <HotelClock letter={leg.checkOut} official={leg.officialOut} />
        </div>
        <div className="fam-kv">
          <dt>今早</dt>
          <dd>
            <BreakfastChips value={leg.breakfast} />
          </dd>
        </div>
        <div className="fam-kv">
          <dt>今晚</dt>
          <dd>
            <BreakfastChips value={leg.dinner} />
          </dd>
        </div>
      </dl>
    );
  }

  return (
    <dl>
      <div className="fam-kv">
        <dt>入住</dt>
        <HotelClock letter={leg.checkIn} official={leg.officialIn} />
      </div>
      <div className="fam-kv">
        <dt>退房</dt>
        <HotelClock letter={leg.checkOut} official={leg.officialOut} />
      </div>
      <div className="fam-kv">
        <dt>今早</dt>
        <dd>
          <BreakfastChips value={leg.breakfast} />
        </dd>
      </div>
      <div className="fam-kv">
        <dt>今晚</dt>
        <dd>
          <BreakfastChips value={leg.dinner} />
        </dd>
      </div>
    </dl>
  );
}

function LegCard({ leg }: { leg: TripLeg }) {
  if (leg.kind === "flight") {
    return (
      <article className="leg-card" data-kind="flight">
        <div className="flex items-center gap-3">
          <FamIconWell name="plane" well="sky" />
          <div>
            <p className="fam-label">{leg.sticker}</p>
            {leg.english ? (
              <p className="fam-en" style={{ marginTop: 0 }}>
                {leg.english}
              </p>
            ) : null}
          </div>
        </div>
        <dl>
          <div className="fam-kv">
            <dt>{leg.routeLabel}</dt>
            <dd>{leg.route}</dd>
          </div>
          <div className="fam-kv">
            <dt>航班</dt>
            <dd>{leg.flight}</dd>
          </div>
          <div className="fam-kv">
            <dt>時間</dt>
            <dd>{leg.time}</dd>
          </div>
        </dl>
        <Refs refs={leg.refs} />
      </article>
    );
  }

  if (leg.kind === "car") {
    return (
      <article className="leg-card" data-kind="car">
        <div className="flex items-center gap-3">
          <FamIconWell name="car" well="mint" />
          <div>
            <p className="fam-label">{leg.sticker}</p>
            {leg.english ? (
              <p className="fam-en" style={{ marginTop: 0 }}>
                {leg.english}
              </p>
            ) : null}
          </div>
        </div>
        <dl>
          {leg.pickup ? (
            <div className="fam-kv">
              <dt>取車</dt>
              <dd>{leg.pickup}</dd>
            </div>
          ) : null}
          <div className="fam-kv">
            <dt>還車</dt>
            <dd>{leg.dropoff}</dd>
          </div>
          <div className="fam-kv">
            <dt>車型</dt>
            <dd>{leg.model}</dd>
          </div>
        </dl>
        <Refs refs={leg.refs} />
      </article>
    );
  }

  return (
    <article className="leg-card" data-kind="hotel">
      <div className="flex items-center gap-3">
        <FamIconWell name="hotel" well="blush" />
        <div>
          <p className="fam-label">{leg.sticker}</p>
          <p className="mt-1 text-base font-bold">{leg.name}</p>
        </div>
      </div>
      <HotelFields leg={leg} />
      {leg.extras ? (
        <p className="fam-extras">
          <span className="fam-extras-sticker">{leg.extras}</span>
        </p>
      ) : null}
      {leg.note ? <p className="fam-empty-line">{leg.note}</p> : null}
      <Refs refs={leg.refs} />
      <Refs label="官網聯絡" refs={leg.official} />
    </article>
  );
}

function TodayCard({ day, isCalendarToday }: { day: FamilyTripDay; isCalendarToday: boolean }) {
  return (
    <article className="today-card">
      <div className="fam-stickers">
        {isCalendarToday ? <span className="fam-sticker-chip fam-sticker-honey">今天</span> : null}
        <span className="fam-muted">先看這幾行</span>
      </div>
      <dl>
        <div className="fam-kv">
          <dt>今晚住</dt>
          <dd>{day.stay}</dd>
        </div>
        <div className="fam-kv">
          <dt>今早</dt>
          <dd>
            <BreakfastChips value={day.breakfast} />
          </dd>
        </div>
        <div className="fam-kv">
          <dt>今晚</dt>
          <dd>
            <BreakfastChips value={day.dinner} />
          </dd>
        </div>
        <div className="fam-kv">
          <dt>下一步</dt>
          <dd>{day.next}</dd>
        </div>
      </dl>
    </article>
  );
}

function CarryPocket() {
  return (
    <article className="fam-carry">
      <p className="fam-label">{familyTripCarry.title}</p>
      {familyTripCarry.flights.map((line) => (
        <span className="fam-ref" key={line}>
          {line}
        </span>
      ))}
      {familyTripCarry.car.map((line) => (
        <span className="fam-ref" key={line}>
          {line}
        </span>
      ))}
    </article>
  );
}

export default function FamilyTripPage() {
  const router = useRouter();
  const [authenticated, setAuthenticated] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  const calendarToday = useMemo(() => taipeiCalendarDate(), []);
  const calendarDay = tripDayFromCalendarDate(calendarToday);
  const activeDay = selected ?? calendarDay ?? defaultTripDay();
  const day = familyTripDays[activeDay - 1] ?? familyTripDays[0];

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
          <p className="fam-lede">早上打開這頁。下一步會在最上面。</p>
          <CarryPocket />
        </div>
      </header>

      <nav aria-label="行程日期" className="fam-day-strip">
        <div className="fam-day-strip-inner">
          {familyTripDays.map((item) => {
            const isToday = item.day === calendarDay;
            const isActive = item.day === activeDay;
            return (
              <button
                className={`fam-day-btn${isActive ? " is-active" : ""}`}
                key={item.date}
                onClick={() => setSelected(item.day)}
                type="button"
              >
                <span className="fam-day-dot">{item.day}</span>
                <span className="fam-day-date">{isToday ? formatTripMd(item.date) : ""}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <section className="fam-sheet">
        <TodayCard day={day} isCalendarToday={day.day === calendarDay} />
        <div className="mt-4 grid gap-3">
          {day.legs.map((leg, index) => (
            <LegCard key={`${leg.kind}-${index}`} leg={leg} />
          ))}
        </div>
      </section>

      <section className="fam-sheet">
        <p className="fam-script" style={{ marginTop: 0 }}>
          the week
        </p>
        <h2 className="fam-title">八天總表</h2>
        <p className="fam-lede">一長頁往下捲。不是試算表。</p>
        <ul className="mt-5 grid gap-3">
          {familyTripDays.map((item) => {
            const isToday = item.day === calendarDay;
            const isActive = item.day === activeDay;
            return (
              <li key={item.date}>
                <button
                  className={`fam-week-row w-full text-left${isToday ? " is-today" : ""}${isActive ? " is-active" : ""}`}
                  onClick={() => setSelected(item.day)}
                  type="button"
                >
                  <span className="fam-day-dot" style={isActive ? { background: "var(--fam-blush)", color: "#fffbfa" } : undefined}>
                    {item.day}
                  </span>
                  <span>
                    <span className="flex flex-wrap items-center gap-2">
                      <strong>{isToday ? "今天" : `第${item.day}天`}</strong>
                      {isToday ? <span className="fam-muted">{formatTripMd(item.date)}</span> : null}
                    </span>
                    <span className="fam-kv">
                      <dt>今晚住</dt>
                      <dd>{item.stay}</dd>
                    </span>
                    <span className="fam-kv">
                      <dt>今早</dt>
                      <dd>
                        <BreakfastChips value={item.breakfast} />
                      </dd>
                    </span>
                    <span className="fam-kv">
                      <dt>今晚</dt>
                      <dd>
                        <BreakfastChips value={item.dinner} />
                      </dd>
                    </span>
                    <span className="fam-kv">
                      <dt>下一步</dt>
                      <dd>{item.next}</dd>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
