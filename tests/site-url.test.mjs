import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PUBLIC_SITE_ORIGIN,
  publicSiteUrl,
  resolvePublicSiteOrigin,
  VERCEL_SPARE_ORIGIN,
} from "../lib/site-url.ts";

test("public origin defaults to Cloudflare workers.dev, not Vercel", () => {
  assert.equal(DEFAULT_PUBLIC_SITE_ORIGIN, "https://travelos2.chao-jason.workers.dev");
  assert.equal(resolvePublicSiteOrigin({}), DEFAULT_PUBLIC_SITE_ORIGIN);
  assert.equal(resolvePublicSiteOrigin({ VERCEL: "1", VERCEL_URL: "travelos2-63r3.vercel.app" }), DEFAULT_PUBLIC_SITE_ORIGIN);
  assert.equal(
    resolvePublicSiteOrigin({ SITE_URL: VERCEL_SPARE_ORIGIN, NEXT_PUBLIC_SITE_URL: VERCEL_SPARE_ORIGIN }),
    DEFAULT_PUBLIC_SITE_ORIGIN,
  );
  assert.equal(publicSiteUrl("/trips/finland-lapland-winter-journal", {}), `${DEFAULT_PUBLIC_SITE_ORIGIN}/trips/finland-lapland-winter-journal`);
});

test("SITE_URL / NEXT_PUBLIC_SITE_URL can set a non-Vercel custom origin", () => {
  assert.equal(
    resolvePublicSiteOrigin({ SITE_URL: "https://travel.example/" }),
    "https://travel.example",
  );
  assert.equal(
    resolvePublicSiteOrigin({
      NEXT_PUBLIC_SITE_URL: "https://journal.example",
      SITE_URL: "https://ignored.example",
    }),
    "https://journal.example",
  );
  assert.equal(
    publicSiteUrl("/trips/finland-lapland-winter-journal", { SITE_URL: "https://travel.example" }),
    "https://travel.example/trips/finland-lapland-winter-journal",
  );
});
