import { Suspense } from "react";
import type { Metadata } from "next";
import { JournalHeader, LibrarySkeleton } from "@/components/journey-library";
import { LibraryContent } from "@/components/library-content";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "TravelOS · 旅途與日常", description: "收藏走過的風景，也收藏一起的時光。真實照片與旅行故事。" };
export default function HomePage() {
  return <main className="journal-site"><JournalHeader home /><div className="jl-wrap"><section className="jl-intro jl-intro-home"><p className="jl-eyebrow">PLACES WE GO. MOMENTS WE KEEP.</p><h1>世界很大，<em>一起慢慢走。</em></h1><p>把旅行的風景，留成可以一再翻閱的故事。</p></section><Suspense fallback={<LibrarySkeleton />}><LibraryContent home /></Suspense><section className="jl-notebook"><div><p className="jl-eyebrow">LITTLE EVERYDAY JOURNEYS</p><h2>旅行之外，<br />還有一杯咖啡的時光。</h2></div><a className="jl-button" href="/coffee">打開咖啡記憶 ↗</a></section><footer className="jl-footer"><span>TravelOS · 把日子，寫成故事。</span><a href="/family">家庭編輯 ↗</a></footer></div></main>;
}
