import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function readerModule(trip: unknown) {
  const requested: string[] = [];
  const source = await readFile(new URL("../app/trips/[slug]/page.tsx", import.meta.url), "utf8");
  const modules: Record<string, unknown> = {
    react: { cache: (fn: unknown) => fn },
    "@/lib/public-trip": { readPublicTripBySlug: async (slug: string) => { requested.push(slug); return trip; } },
    "@/lib/trip-visibility": { isTripPublic: () => true },
    "@/lib/lapland-storefront-copy": { storefrontMetaDescription: (summary: string) => summary },
    "next/navigation": { notFound: () => { throw new Error("NOT_FOUND"); } },
  };
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: any = {};
  new Function("require", "exports", output)((id: string) => {
    if (id === "@/lib/editable-store") throw new Error("Reader must not load the full editable store");
    return modules[id] ?? {};
  }, exports);
  return { exports, requested };
}

test("reader metadata requests only the selected public slug", async () => {
  const { exports, requested } = await readerModule({ slug: "selected", title: "Selected story", city: "Kyoto", country: "Japan", summary: "Saved story", photos: [] });
  const metadata = await exports.generateMetadata({ params: Promise.resolve({ slug: "selected" }) });
  assert.deepEqual(requested, ["selected"]);
  assert.equal(metadata.title, "Selected story - Kyoto, Japan");
});

test("missing public reader uses the same selected lookup and returns not found", async () => {
  const { exports, requested } = await readerModule(null);
  await assert.rejects(exports.default({ params: Promise.resolve({ slug: "missing" }) }), /NOT_FOUND/);
  assert.deepEqual(requested, ["missing"]);
});
