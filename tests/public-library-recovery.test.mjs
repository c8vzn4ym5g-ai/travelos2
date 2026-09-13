import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
function load(relative, overrides, globals = {}) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(js, { exports, require: name => overrides[name] ?? require(name), ...globals });
  return exports;
}

test("cold public library does not tell readers there are zero journeys", async () => {
  const page = load("../app/trips/page.tsx", {
    "@/components/public-hub-retry": { PublicHubRetry: () => "RETRY" },
    "@/components/storefront-home-link": { StorefrontHomeLink: () => "HOME" },
    "@/lib/lapland-storefront-copy": { isLaplandStorefrontSlug: () => false },
    "@/lib/public-hub": { readPublicHubState: async () => ({ trips: [], ready: false }) },
  });
  const html = renderToStaticMarkup(await page.default());
  assert.doesNotMatch(html, />0<\/p>/);
  assert.match(html, /RETRY/);
});

test("failed initial load offers native recovery and stops automatic retries", () => {
  const timers = []; const cleared = []; let refreshed = 0; let paused = false; let cleanup; let previousDeps;
  const router = { refresh: () => { refreshed++; } };
  const component = load("../components/public-hub-retry.tsx", {
    react: { useState: () => [paused, value => { paused = value; }], useEffect: (fn, deps) => {
      if (!previousDeps || deps.some((dep,i) => dep !== previousDeps[i])) { cleanup?.(); cleanup=fn(); previousDeps=deps; }
    } },
    "next/navigation": { useRouter: () => router },
  }, {
    setTimeout: (fn, ms) => { timers.push({fn, ms}); return timers.length; },
    clearTimeout: id => cleared.push(id),
    setInterval: () => { throw new Error("unbounded polling recreates the reported stuck screen"); },
  });
  const html = renderToStaticMarkup(component.PublicHubRetry({ href: "/trips" }));
  assert.match(html, /action="\/trips"/);
  assert.match(html, /重新載入/);
  for (const timer of timers.sort((a,b) => a.ms-b.ms)) {
    timer.fn();
    renderToStaticMarkup(component.PublicHubRetry({ href: "/trips" }));
  }
  assert.equal(refreshed, 2);
  assert.equal(paused, true);
  assert.equal(timers.length, 3);
  assert.match(renderToStaticMarkup(component.PublicHubRetry({ href: "/trips" })), /目前未能載入/);
  cleanup();
  assert.equal(cleared.length, 3);
});

test("confirmed empty public library shows a real zero without retrying", async () => {
  const page = load("../app/trips/page.tsx", {
    "@/components/public-hub-retry": { PublicHubRetry: () => "RETRY" },
    "@/components/storefront-home-link": { StorefrontHomeLink: () => "HOME" },
    "@/lib/lapland-storefront-copy": { isLaplandStorefrontSlug: () => false },
    "@/lib/public-hub": { readPublicHubState: async () => ({ trips: [], ready: true }) },
  });
  const html = renderToStaticMarkup(await page.default());
  assert.match(html, />0<\/p>/);
  assert.doesNotMatch(html, /RETRY/);
  assert.match(html, /尚無已發布的旅程/);
});
