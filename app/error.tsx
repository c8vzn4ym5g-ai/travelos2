"use client";
import { useEffect, useRef, useState } from "react";
import { editingReturn, pageFailure } from "@/lib/page-failure";

export default function TravelError({ error, reset }: { error: Error & {digest?: string}; reset: () => void }) {
  const [reference, setReference] = useState("");
  const [recorded, setRecorded] = useState(false);
  const [returnTo, setReturnTo] = useState("/trips");
  const reported = useRef<Error | null>(null);
  useEffect(() => {
    if (reported.current === error) return;
    reported.current = error;
    setReturnTo(editingReturn(window.location.search));
    const id = crypto.randomUUID();
    setReference(id.slice(0, 8));
    setRecorded(false);
    const detail = pageFailure(error, window.location.pathname);
    void fetch("/api/page-failure", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({id, ...detail}), keepalive: true,
    }).then(response => setRecorded(response.ok)).catch(() => {});
  }, [error]);
  return <main className="mx-auto max-w-lg px-5 py-16 text-zinc-900">
    <p className="mb-4 font-semibold text-sky-800">TravelOS</p>
    <h1 className="text-2xl font-semibold">這個頁面暫時未能開啟</h1>
    <p className="mt-4 leading-7">可以再試一次，或回到家庭編輯繼續。這個畫面不代表已儲存的內容被刪除。</p>
    <div className="mt-6 flex flex-wrap gap-3">
      <a className="min-h-11 rounded-full border border-sky-800 px-6 py-3 text-sky-900" href={returnTo}>返回遊記</a>
      <button className="min-h-11 rounded-full bg-sky-800 px-6 py-3 font-semibold text-white" onClick={() => {
        if (pageFailure(error, window.location.pathname).kind === "page-update") window.location.reload();
        else reset();
      }} type="button">再試一次</button>
      <a className="min-h-11 rounded-full border border-sky-800 px-6 py-3 text-sky-900" href="/trips/admin">返回家庭編輯</a>
      <a className="min-h-11 rounded-full border px-6 py-3" href="/">返回旅行首頁</a>
    </div>
    <button className="mt-5 min-h-11 underline" type="button" onClick={() => window.location.reload()}>重新開啟此頁</button>
    {reference ? <p className="mt-6 text-sm text-zinc-500">{recorded ? "錯誤已記錄" : "錯誤參考"} · {reference}</p> : null}
  </main>;
}
