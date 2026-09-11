"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { validStats, type PublicStats } from "@/lib/public-stats";

export default function FamilyStatsPage() {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      const data: unknown = await response.json();
      if (!response.ok || !validStats(data)) throw new Error("unavailable");
      setStats(data);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return (
    <main className="fam-page" lang="zh-Hant">
      <header className="fam-hero">
        <div className="fam-hero-inner">
          <Link className="fam-pill min-h-11 inline-flex items-center" href="/family">← 回家</Link>
          <p className="fam-script" aria-hidden="true">🌱</p>
          <h1 className="fam-title">小小足跡</h1>
          <p className="fam-lede">看看有多少朋友，來逛我們的旅行與咖啡。</p>
        </div>
      </header>
      <section className="fam-sheet" aria-live="polite" aria-busy={loading}>
        {loading && <p>正在收集足跡⋯</p>}
        {error && <p role="alert">暫時讀不到足跡，請稍後再試。{stats ? "下方保留上次讀到的數字。" : "現在無法確認人數。"}</p>}
        {stats && <>
          <p className="fam-section">一起走向 300 位朋友 🌷</p>
          <p className="my-4 text-5xl font-bold text-teal-800">{stats.goalUVApprox}<span className="text-lg"> / 300 位</span></p>
          <progress className="h-4 w-full accent-teal-700" value={Math.min(stats.goalUVApprox, 300)} max={300} aria-label="九月二十一日前累計訪客目標" />
          <p className="mt-3">{stats.goalUVApprox >= 300 ? "達標了！謝謝每一個來逛逛的人。" : `距離目標還有 ${300 - stats.goalUVApprox} 位。`}目標日：2026 年 9 月 21 日（台北時間，含當天）。</p>
          <div className="my-6 grid grid-cols-2 gap-3">
            <div className="fam-tile fam-tile-sky"><span className="text-3xl font-bold">{stats.todayUV}</span><span>今天的訪客</span></div>
            <div className="fam-tile fam-tile-blush"><span className="text-3xl font-bold">{stats.todayPV}</span><span>今天的瀏覽次數</span></div>
          </div>
          <p>開始記錄：{stats.since || "等待第一個足跡"}。累計約 {stats.totalUVApprox} 位不同瀏覽器訪客。</p>
          <p className="mt-3 text-sm leading-7">同一瀏覽器在台北時間同一天重訪，只算 1 位訪客；每次開啟公開頁面算 1 次瀏覽。目標人數會跨日去重，並只計入截止日以前的訪客。換裝置或清除 Cookie 可能重複計算；未允許 Cookie、未執行 JavaScript 或被擋下的紀錄不會計入。這是瀏覽器估算，不是實際人數。</p>
          <h2 className="fam-section mt-6">每天的足跡</h2>
          {stats.days.length ? <table className="mt-3 w-full text-left"><caption className="sr-only">台北時間每日訪客與瀏覽次數</caption><thead><tr><th scope="col" className="py-3">日期</th><th scope="col">訪客</th><th scope="col">瀏覽</th></tr></thead><tbody>{[...stats.days].reverse().map(day => <tr key={day.date} className="border-t border-teal-100"><th scope="row" className="py-3 font-normal">{day.date}</th><td>{day.uv}</td><td>{day.pv}</td></tr>)}</tbody></table> : <p className="mt-3">第一個足跡來了，就會出現在這裡。</p>}
        </>}
        <button className="fam-pill fam-pill-blush mt-5 min-h-11 px-5" disabled={loading} onClick={() => void refresh()}>更新足跡 ↻</button>
      </section>
    </main>
  );
}
