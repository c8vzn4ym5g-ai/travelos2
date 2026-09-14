"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { HubTripCard } from "@/lib/public-hub";

export function JourneyLibrary({ trips, home = false }: { trips: HubTripCard[]; home?: boolean }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("全部");
  const key = home ? "travelos-home-position" : "travelos-library-position";
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || "null");
      if (saved) { setQuery(saved.query || ""); setCountry(saved.country || "全部"); }
    } catch { /* Browsing remains available without session storage. */ }
  }, [key]);
  function remember() {
    try { sessionStorage.setItem(key, JSON.stringify({ query, country })); sessionStorage.setItem("travelos-reader-origin", home ? "/" : "/trips"); } catch {}
  }
  const countries = ["全部", ...new Set(trips.map(trip => trip.country).filter(Boolean))];
  const shown = trips.filter(trip => (country === "全部" || trip.country === country) && [trip.title, trip.city, trip.country, trip.summary].join(" ").toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const featured = home && !query && country === "全部" ? (trips.find(trip => trip.slug.includes("higashiyama")) ?? trips[0]) : null;
  const href = (trip: HubTripCard) => `/trips/${trip.slug}?id=${encodeURIComponent(trip.id)}`;
  return <>
    {featured ? <Link prefetch={false} href={href(featured)} onClick={remember} className="jl-feature">
      {featured.coverPhoto ? <img src={featured.coverPhoto.storageKey} alt={featured.coverPhoto.caption || featured.title} fetchPriority="high" /> : null}
      <div className="jl-feature-shade" />
      <div className="jl-feature-copy"><span className="jl-eyebrow">FEATURED JOURNEY · 精選旅程</span><h2>{featured.title}</h2><p>{featured.summary}</p><span className="jl-feature-button">走進這段旅程 <span aria-hidden="true">↗</span></span></div>
      <span className="jl-feature-place">{featured.country} · {featured.city}</span>
    </Link> : null}
    <section className="jl-collection" id="journeys">
      <div className="jl-section-heading"><div><p className="jl-eyebrow">THE JOURNAL</p><h2>{home ? "把旅程，再走一遍。" : "我們的旅行收藏"}</h2></div><span className="jl-count">{trips.length} 篇旅程</span></div>
      <div className="jl-tools"><div className="jl-filters" aria-label="依國家篩選">{countries.map(item => <button type="button" key={item} aria-pressed={country === item} onClick={() => setCountry(item)}>{item}</button>)}</div><label className="jl-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="搜尋旅程" placeholder="尋找城市、故事…" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <div className="jl-grid">{shown.map((trip, index) => <article className="jl-card" key={trip.id}>
        <Link prefetch={false} href={href(trip)} onClick={remember} aria-label={`閱讀 ${trip.title}`}>
          <div className="jl-card-image">{trip.coverPhoto ? <img src={trip.coverPhoto.storageKey} alt={trip.coverPhoto.caption || trip.title} loading={index < 2 && !home ? "eager" : "lazy"} decoding="async" /> : <span>Travel journal</span>}<span className="jl-card-arrow" aria-hidden="true">↗</span></div>
          <div className="jl-card-copy"><p className="jl-eyebrow">{trip.country} · {trip.city}</p><h3>{trip.title}</h3><p className="jl-card-summary">{trip.summary}</p><div className="jl-card-foot"><span>旅途記憶</span><span>閱讀故事 →</span></div></div>
        </Link>
      </article>)}</div>
      {shown.length === 0 ? <div className="jl-empty"><h3>還沒找到這段旅程</h3><p>換個城市名稱，或看看全部收藏。</p><button className="jl-button" onClick={() => { setCountry("全部"); setQuery(""); }} type="button">查看全部旅程</button></div> : null}
    </section>
  </>;
}
export function JournalHeader({ home = false, category = "trips" }: { home?: boolean; category?: "trips" | "coffee" | "food" }) {
  return <header className="jl-header"><Link href="/" prefetch={false} className="jl-brand">TravelOS<span>旅途 · 日常 · 記憶</span></Link><nav aria-label="主導覽"><Link href="/trips" prefetch={false} aria-current={!home && category === "trips" ? "page" : undefined}>旅行故事</Link><Link href="/coffee" prefetch={false} aria-current={category === "coffee" ? "page" : undefined}>咖啡記憶</Link><Link href="/food" prefetch={false} aria-current={category === "food" ? "page" : undefined}>美食記事</Link><Link className="jl-edit-link" href="/family" prefetch={false}>家庭編輯 ↗</Link></nav></header>;
}
export function LibrarySkeleton() {
  return <div className="jl-skeleton" role="status"><p>正在打開旅行收藏…</p><div /><div /><div /></div>;
}


