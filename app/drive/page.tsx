import Link from "next/link";
import Script from "next/script";

export default function DrivePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link className="text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/trips">
                Travel
              </Link>
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/coffee">
                Coffee
              </Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">Travelpayouts Drive</p>
            <h1 className="mt-2 max-w-4xl text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">
              Drive booking tools for trips.
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-600">
              A separate Drive workspace for rental-car and road-trip tools, kept apart from your travel journals and coffee notes.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
          <div id="travelpayouts-drive-widget" className="min-h-96 rounded-md bg-stone-50" />
        </div>
      </section>

      <Script data-cfasync="false" data-no-defer="1" data-noptimize="1" data-wpfc-render="false" seraph-accel-crit="1" src="https://emrldtp.cc/NTUwMzEz.js?t=550313" strategy="afterInteractive" />
    </main>
  );
}
