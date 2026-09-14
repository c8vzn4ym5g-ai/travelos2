import { ReaderBack } from "@/components/journal-reader";
export default function ReaderLoading() {
  return <main className="journal-site"><header className="jr-topbar"><ReaderBack /><span className="jl-brand">TravelOS</span><span /></header><div className="jl-wrap"><div className="jl-intro"><p className="jl-eyebrow">A JOURNEY IS OPENING</p><h1>正在翻開這段旅程…</h1><p role="status">照片與故事正在路上，請稍候。</p></div><div className="jl-skeleton"><div /></div></div></main>;
}
