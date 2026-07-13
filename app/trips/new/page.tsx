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

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <select className={fieldClass} defaultValue="" name={name}>
        <option disabled value="">
          Select
        </option>
        {options.map((option) => (
          <option key={option} value={option.toLowerCase()}>
            {option}
          </option>
        ))}
      </select>
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

export default function NewTripPage() {
  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <div className="flex items-center justify-between gap-4">
            <Link className="text-sm font-medium text-teal-700" href="/trips">
              Trips
            </Link>
            <span className="rounded-md bg-stone-100 px-3 py-1 text-sm font-medium text-zinc-700">Draft only</span>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1fr_18rem] lg:items-end">
            <div>
              <p className="text-sm font-medium uppercase text-zinc-500">Trip editor</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Create a trip draft</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
                Capture the core trip record, first memory notes, useful places, and starting cost estimates before persistence is connected.
              </p>
            </div>
            <div className="rounded-lg border border-dashed border-zinc-300 bg-stone-100 p-4 text-sm leading-6 text-zinc-600">
              This screen is intentionally non-saving for the MVP draft step. Database persistence arrives in a later task.
            </div>
          </div>
        </div>
      </section>
      <form className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
        <div className="space-y-6">
          <FormSection kicker="Overview" title="Trip record">
            <Field label="Trip title" name="title" placeholder="Autumn rail route through Hokkaido" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Country" name="country" placeholder="Japan" />
              <Field label="City or base" name="city" placeholder="Sapporo" />
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Start date" name="startDate" placeholder="2026-10-04" type="date" />
              <Field label="End date" name="endDate" placeholder="2026-10-17" type="date" />
            </div>
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Summary</span>
              <textarea
                className="mt-2 min-h-28 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-700"
                name="summary"
                placeholder="A concise memory of why this trip matters and what it includes."
              />
            </label>
          </FormSection>
          <FormSection kicker="Journal" title="First memory note">
            <Field label="Entry title" name="entryTitle" placeholder="Arrival walk after check-in" />
            <label className="block">
              <span className="text-sm font-medium text-zinc-700">Entry body</span>
              <textarea
                className="mt-2 min-h-32 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-teal-700"
                name="entryBody"
                placeholder="Write the first narrative note for this trip."
              />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Mood" name="mood" placeholder="Rested" />
              <Field label="Weather" name="weather" placeholder="Clear and cool" />
            </div>
          </FormSection>
        </div>
        <aside className="space-y-6">
          <FormSection kicker="Places" title="First saved place">
            <SelectField
              label="Place type"
              name="placeType"
              options={["Hotel", "Restaurant", "Attraction", "Airport", "Station", "Shopping", "Other"]}
            />
            <Field label="Place name" name="placeName" placeholder="Sapporo base hotel" />
            <Field label="Address or neighborhood" name="placeAddress" placeholder="Chuo Ward" />
            <Field label="Notes" name="placeNotes" placeholder="Good transit access; quiet room." />
          </FormSection>
          <FormSection kicker="Costs" title="Starting budget item">
            <SelectField
              label="Category"
              name="costCategory"
              options={["Flight", "Hotel", "Food", "Transportation", "Attraction", "Shopping", "Insurance", "Other"]}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Amount" name="amount" placeholder="1200" type="number" />
              <Field label="Currency" name="currency" placeholder="USD" />
            </div>
            <Field label="Merchant" name="merchant" placeholder="Hotel or airline" />
          </FormSection>
          <section className="rounded-lg border border-zinc-200 bg-white p-6">
            <p className="text-xs font-semibold uppercase text-teal-700">Actions</p>
            <div className="mt-5 grid gap-3">
              <button
                className="rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white opacity-60"
                disabled
                type="button"
              >
                Save draft later
              </button>
              <button
                className="rounded-md border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-700 opacity-60"
                disabled
                type="button"
              >
                Publish later
              </button>
              <Link className="rounded-md border border-zinc-300 px-4 py-3 text-center text-sm font-semibold text-zinc-950" href="/trips">
                Return to trips
              </Link>
            </div>
          </section>
        </aside>
      </form>
    </main>
  );
}
