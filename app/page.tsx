import Link from "next/link";

const stats = [
  { label: "Countries", value: "18" },
  { label: "Cities", value: "87" },
  { label: "Travel days", value: "196" },
  { label: "Journal entries", value: "152" },
];

const journeys = [
  { place: "Hokkaido, Japan", date: "Autumn 2025", note: "Seafood, hot springs, and a slower northern route." },
  { place: "Bangkok, Thailand", date: "Spring 2025", note: "Food notes, hotel reviews, markets, and day trips." },
  { place: "Paris, France", date: "Winter 2024", note: "Museum days, neighborhood walks, and favorite cafes." },
];

const tasks = [
  "Set up the application shell",
  "Create the travel journal data model",
  "Build the trip creation flow",
  "Add map and timeline browsing",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-8 lg:px-10">
          <nav className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">TravelOS</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal text-zinc-950 sm:text-6xl">Your travel memory system.</h1>
            </div>
            <div className="hidden gap-2 sm:flex">
              <Link className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-950" href="/trips/new">
                New draft
              </Link>
              <Link className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white" href="/trips">
                View trips
              </Link>
            </div>
          </nav>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((item) => (
              <div className="rounded-lg border border-zinc-200 bg-stone-50 p-5" key={item.label}>
                <p className="text-sm text-zinc-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-7xl gap-8 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold">World map workspace</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">TASK-001 will turn this starter into a durable foundation for trips, albums, costs, places, and AI-assisted memory search.</p>
            </div>
            <span className="rounded-md bg-teal-50 px-3 py-1 text-sm font-medium text-teal-800">Starter</span>
          </div>
          <div className="mt-8 grid min-h-[320px] place-items-center rounded-lg border border-dashed border-zinc-300 bg-stone-100">
            <div className="text-center">
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-zinc-500">Map placeholder</p>
              <p className="mt-3 text-3xl font-semibold text-zinc-900">Routes, pins, and memories live here.</p>
            </div>
          </div>
        </div>
        <aside className="space-y-6">
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Latest journeys</h2>
            <div className="mt-5 space-y-4">
              {journeys.map((journey) => (
                <article className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0" key={journey.place}>
                  <p className="font-medium">{journey.place}</p>
                  <p className="mt-1 text-sm text-zinc-500">{journey.date}</p>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">{journey.note}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-6">
            <h2 className="text-xl font-semibold">Codex queue</h2>
            <ol className="mt-5 space-y-3">
              {tasks.map((task, index) => (
                <li className="flex gap-3 text-sm" key={task}>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-950 text-xs font-semibold text-white">{index + 1}</span>
                  <span className="pt-1 text-zinc-700">{task}</span>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </section>
    </main>
  );
}
