import Link from "next/link";

export default function Loading() {
  return <main className="mx-auto min-h-screen max-w-6xl px-5 py-8 text-stone-800">
    <nav aria-label="主要導覽" className="flex flex-wrap gap-3">
      <Link className="rounded-full border px-5 py-3" href="/trips">閱讀游記</Link>
    </nav>
    <p className="mt-12 text-sm" role="status">正在取回最新內容…</p>
    <div aria-hidden="true" className="mt-6 h-64 animate-pulse rounded-3xl bg-stone-100" />
  </main>;
}
