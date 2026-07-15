import Link from "next/link";

const fieldClass =
  "mt-2 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-700";

function Field({
  label,
  name,
  placeholder,
  type = "text",
}: {
  label: string;
  name: string;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input className={fieldClass} name={name} placeholder={placeholder} type={type} />
    </label>
  );
}

function FormSection({
  children,
  kicker,
  title,
}: Readonly<{
  children: React.ReactNode;
  kicker: string;
  title: string;
}>) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase text-teal-700">{kicker}</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-950">{title}</h2>
      <div className="mt-6 grid gap-5">{children}</div>
    </section>
  );
}

export default function NewCoffeePage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/coffee">
              Coffee Map
            </Link>
            <span className="rounded-md bg-stone-100 px-3 py-1 text-sm font-medium text-zinc-700">Draft only</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Quick capture</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Add a coffee shop</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Built for real use while sitting in a cafe: paste the map link, add the address, upload photo notes later,
                and capture the life memory before it disappears.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-zinc-300 bg-stone-100 p-4 text-sm leading-6 text-zinc-600">
              This is a non-saving draft UI for now. Persistence, uploads, and mobile capture can be wired in a later task.
            </div>
          </div>
        </div>
      </section>
      <form className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="space-y-6">
          <FormSection kicker="Place" title="Coffee shop record">
            <Field label="Shop name" name="name" placeholder="Riverside Espresso Stop" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Country" name="country" placeholder="Thailand" />
              <Field label="City" name="city" placeholder="Bangkok" />
            </div>
            <Field label="Address" name="address" placeholder="Paste address or neighborhood" />
            <Field label="Google Maps or web link" name="mapUrl" placeholder="https://maps.google.com/..." type="url" />
          </FormSection>
          <FormSection kicker="Memory" title="Coffee and life note">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Visit date" name="visitedAt" placeholder="2026-07-16" type="date" />
              <Field label="Coffee ordered" name="coffeeOrdered" placeholder="Iced americano" />
            </div>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Comments</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-700"
                name="comments"
                placeholder="Taste, service, seat, music, laptop-friendliness, view, or anything practical."
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Life note</span>
              <textarea
                className="mt-2 min-h-32 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-700"
                name="lifeNote"
                placeholder="What happened in your life here? What did this coffee moment mean?"
              />
            </label>
          </FormSection>
        </div>
        <aside className="space-y-6">
          <FormSection kicker="Photos" title="Capture slots">
            <Field label="Photo note 1" name="photoOne" placeholder="Cup by the window" />
            <Field label="Photo note 2" name="photoTwo" placeholder="Shop front / menu / table" />
            <Field label="Tags" name="tags" placeholder="quiet, laptop-friendly, best latte" />
          </FormSection>
          <FormSection kicker="Optional link" title="Connect to a trip later">
            <Field label="Related trip" name="linkedTrip" placeholder="Paris winter museums, optional" />
            <Field label="Rating" name="rating" placeholder="5" type="number" />
          </FormSection>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase text-teal-700">Actions</p>
            <div className="mt-5 grid gap-3">
              <button
                className="rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white opacity-60"
                disabled
                type="button"
              >
                Save later
              </button>
              <Link className="rounded-md border border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-950" href="/coffee">
                Return to coffee map
              </Link>
            </div>
          </section>
        </aside>
      </form>
    </main>
  );
}
