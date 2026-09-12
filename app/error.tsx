"use client";

export default function TravelError({ reset }: { reset: () => void }) {
  return <main className="mx-auto max-w-lg px-5 py-16 text-zinc-900">
    <h1 className="text-2xl font-semibold">暫時沒有取回內容</h1>
    <p className="mt-4 leading-7">請確認網路後再試一次。已儲存的內容仍留在原處。</p>
    <button className="mt-6 min-h-11 rounded-full bg-sky-800 px-6 py-3 font-semibold text-white" onClick={reset} type="button">重新讀取</button>
  </main>;
}
