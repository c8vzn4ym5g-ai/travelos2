import Link from "next/link";

const searchableData = [
  "Trip titles, summaries, countries, cities, and dates",
  "Journal entries, moods, weather notes, and AI-ready summaries",
  "Saved hotels, restaurants, attractions, stations, and addresses",
  "Photo filenames, captions, taken dates, camera metadata, and coordinates",
  "Cost categories, merchants, currencies, dates, and notes",
];

const exampleQuestions = [
  "Which trips had the best food notes under USD 2,000?",
  "Show rainy museum days in Europe.",
  "Find hotels with good transit access in Japan.",
  "Which trips have photos but missing captions?",
];

export default function AssistantPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/">
              TravelOS
            </Link>
            <div className="flex gap-3 text-sm">
              <Link className="font-medium text-zinc-700" href="/trips">
                Trips
              </Link>
              <Link className="font-medium text-zinc-700" href="/costs">
                Costs
              </Link>
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">AI assistant placeholder</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Ask your travel memory</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                This screen defines the future assistant experience without connecting an AI provider before the MVP foundation is ready.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-stone-50 p-4 text-sm leading-6 text-zinc-600">
              Private data stays local to TravelOS until a later task adds authentication, storage, and provider controls.
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase text-teal-700">Question workspace</p>
          <h2 className="mt-2 text-2xl font-semibold">Future prompt surface</h2>
          <div className="mt-6 rounded-lg border border-dashed border-zinc-300 bg-stone-100 p-5">
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Ask TravelOS</span>
              <textarea
                className="mt-2 min-h-36 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none"
                disabled
                placeholder="Example: Find quiet winter museum days with cafe notes."
              />
            </label>
            <button className="mt-4 rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white opacity-60" disabled type="button">
              Search later
            </button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {exampleQuestions.map((question) => (
              <div className="rounded-md border border-zinc-200 bg-stone-50 p-4 text-sm leading-6 text-zinc-700" key={question}>
                {question}
              </div>
            ))}
          </div>
        </section>
        <aside className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-teal-700">Searchable later</p>
            <h2 className="mt-2 text-2xl font-semibold">Indexed memory fields</h2>
            <ul className="mt-6 space-y-3">
              {searchableData.map((item) => (
                <li className="rounded-md bg-stone-50 p-4 text-sm leading-6 text-zinc-700" key={item}>
                  {item}
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase text-teal-700">Not connected yet</p>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              No prompts, journals, photos, locations, or costs are sent to an AI provider in this MVP placeholder.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}
