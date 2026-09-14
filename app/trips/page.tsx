import { Suspense } from "react";
import { JournalHeader, LibrarySkeleton } from "@/components/journey-library";
import { LibraryContent } from "@/components/library-content";
export const dynamic = "force-dynamic";
export default function TripsPage() {
  return <main className="journal-site"><JournalHeader /><div className="jl-wrap"><section className="jl-intro"><p className="jl-eyebrow">OUR TRAVEL JOURNAL</p><h1>收藏走過的風景，<br /><em>也收藏一起的時光。</em></h1><p>每一張照片，都是重回那一天的入口。</p></section><Suspense fallback={<LibrarySkeleton />}><LibraryContent /></Suspense><footer className="jl-footer"><span>TravelOS · 把日子，寫成故事。</span><a href="/family">家庭編輯 ↗</a></footer></div></main>;
}
