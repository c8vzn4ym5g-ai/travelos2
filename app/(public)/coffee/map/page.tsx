import Link from "next/link";
import { CoffeeWorldMap } from "@/components/coffee-world-map";
import { getCoffeeShopDetailsByVisitDate } from "@/lib/coffee";
import { readCoffeeContent } from "@/lib/coffee-store";

export const dynamic = "force-dynamic";

export default async function CoffeeMapPage() {
  const { content } = await readCoffeeContent();
  const shops = getCoffeeShopDetailsByVisitDate(content.shops);

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:px-10">
          <Link className="text-sm font-medium text-teal-700" href="/coffee">
            Coffee Map
          </Link>
          <div>
            <p className="text-sm font-medium uppercase text-zinc-500">Map view</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal sm:text-5xl">Coffee pins across countries</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600">
              A visual coffee memory map for cafe addresses, photos, comments, and small life notes.
            </p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-8 lg:px-10">
        <CoffeeWorldMap shops={shops} />
      </section>
    </main>
  );
}
