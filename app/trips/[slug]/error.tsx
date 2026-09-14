"use client";
import { ReaderBack } from "@/components/journal-reader";
export default function ReaderError({ reset }: { reset: () => void }) {
  return <main className="journal-site"><header className="jr-topbar"><ReaderBack /><span className="jl-brand">TravelOS</span><span /></header><section className="jl-empty"><p className="jl-eyebrow">TAKE A LITTLE PAUSE</p><h1 className="travel-hand text-3xl">這段旅程還沒打開</h1><p>這次連線未完成。可以再試一次，或回到目錄選另一篇。</p><button className="jl-button" type="button" onClick={reset}>重新打開這篇</button></section></main>;
}
