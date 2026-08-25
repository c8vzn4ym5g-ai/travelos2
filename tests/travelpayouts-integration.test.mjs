import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  pathnameFromRequestHeaders,
  shouldLoadTravelpayoutsDrive,
  travelpayoutsDriveScriptHtml,
  TRAVELPAYOUTS_DRIVE_SCRIPT_ID,
  TRAVELPAYOUTS_DRIVE_SCRIPT_URL,
} from "../lib/travelpayouts-drive.ts";
import {
  AVIASALES_SEARCH_URL,
  aviasalesSearchUrl,
  HOTELLOOK_SEARCH_URL,
  hotellookSearchUrl,
  KLOOK_SEARCH_URL,
  klookActivitiesUrl,
  LAPLAND_JOURNAL_PATH,
  laplandBooking,
} from "../lib/travelpayouts.ts";

const root = resolve(import.meta.dirname, "..");

const familySurfaces = [
  "/family",
  "/family/",
  "/family/capture",
  "/family/capture?from=home",
  "/trips/write",
  "/trips/admin",
  "/trips/new",
  "/coffee/admin",
  "/coffee/new",
  "/admin",
  "/api/moments",
  "/api/family/gate",
];

const publicSurfaces = [
  "/",
  "/drive",
  "/trips",
  "/trips/finland-lapland-winter-journal-2020",
  "/coffee",
];

test("Travelpayouts Drive loads once at the public app boundary", async () => {
  const [layout, integration, driveLogic, drivePage, middleware] = await Promise.all([
    readFile(resolve(root, "app/layout.tsx"), "utf8"),
    readFile(resolve(root, "components/travelpayouts-drive.tsx"), "utf8"),
    readFile(resolve(root, "lib/travelpayouts-drive.ts"), "utf8"),
    readFile(resolve(root, "app/drive/page.tsx"), "utf8"),
    readFile(resolve(root, "middleware.ts"), "utf8"),
  ]);

  assert.match(layout, /<TravelpayoutsDrive \/>/);
  assert.match(layout, /<Suspense fallback=\{null\}>/);
  assert.doesNotMatch(integration, /["']use client["']/);
  assert.doesNotMatch(integration, /usePathname/);
  assert.match(integration, /shouldLoadTravelpayoutsDrive/);
  assert.match(integration, /pathnameFromRequestHeaders\(await headers\(\)\)/);
  assert.match(driveLogic, /https:\/\/emrldtp\.cc\/NTUwMzEz\.js\?t=550313/);
  assert.match(integration, /id=\{TRAVELPAYOUTS_DRIVE_SCRIPT_ID\}/);
  assert.match(integration, /src=\{TRAVELPAYOUTS_DRIVE_SCRIPT_URL\}/);
  assert.match(middleware, /TRAVELOS_PATHNAME_HEADER/);
  assert.match(middleware, /request\.nextUrl\.pathname/);
  assert.doesNotMatch(drivePage, /<Script/);
});

test("family HTML does not contain Drive, public trip HTML still can", () => {
  for (const pathname of familySurfaces) {
    const html = travelpayoutsDriveScriptHtml(pathname);
    assert.equal(shouldLoadTravelpayoutsDrive(pathname), false, pathname);
    assert.doesNotMatch(html, /emrldtp\.cc/);
    assert.doesNotMatch(html, /travelpayouts-drive/);
  }

  const publicTripHtml = travelpayoutsDriveScriptHtml("/trips/finland-lapland-winter-journal-2020");
  assert.equal(shouldLoadTravelpayoutsDrive("/trips/finland-lapland-winter-journal-2020"), true);
  assert.match(publicTripHtml, /emrldtp\.cc/);
  assert.match(publicTripHtml, /id="travelpayouts-drive"/);
  assert.match(publicTripHtml, /https:\/\/emrldtp\.cc\/NTUwMzEz\.js\?t=550313/);

  for (const pathname of publicSurfaces) {
    assert.equal(shouldLoadTravelpayoutsDrive(pathname), true, pathname);
    assert.match(travelpayoutsDriveScriptHtml(pathname), /travelpayouts-drive/);
  }

  assert.equal(shouldLoadTravelpayoutsDrive(""), false);
  assert.equal(shouldLoadTravelpayoutsDrive(null), false);
  assert.doesNotMatch(travelpayoutsDriveScriptHtml(null), /emrldtp\.cc/);
  assert.equal(TRAVELPAYOUTS_DRIVE_SCRIPT_ID, "travelpayouts-drive");
  assert.equal(TRAVELPAYOUTS_DRIVE_SCRIPT_URL, "https://emrldtp.cc/NTUwMzEz.js?t=550313");
});

test("Drive pathname comes from the request header, not a guessed widget hash", () => {
  const familyHeaders = new Headers({
    "x-travelos-pathname": "/family",
  });
  const publicHeaders = new Headers({
    "x-travelos-pathname": "/trips/finland-lapland-winter-journal-2020",
  });
  const apiHeaders = new Headers({
    "x-travelos-pathname": "/api/moments/photos",
  });

  assert.equal(pathnameFromRequestHeaders(familyHeaders), "/family");
  assert.equal(shouldLoadTravelpayoutsDrive(pathnameFromRequestHeaders(familyHeaders)), false);
  assert.equal(shouldLoadTravelpayoutsDrive(pathnameFromRequestHeaders(publicHeaders)), true);
  assert.equal(shouldLoadTravelpayoutsDrive(pathnameFromRequestHeaders(apiHeaders)), false);
  assert.equal(pathnameFromRequestHeaders(new Headers()), "");
  assert.equal(shouldLoadTravelpayoutsDrive(pathnameFromRequestHeaders(new Headers())), false);
});

test("public trip and Drive contain a working BookingBand with real brand hrefs", async () => {
  const [tripPage, drivePage, band, disclosure] = await Promise.all([
    readFile(resolve(root, "app/trips/[slug]/page.tsx"), "utf8"),
    readFile(resolve(root, "app/drive/page.tsx"), "utf8"),
    readFile(resolve(root, "components/booking-band.tsx"), "utf8"),
    readFile(resolve(root, "components/affiliate-disclosure.tsx"), "utf8"),
  ]);

  assert.match(tripPage, /<BookingBand destination=\{laplandBooking\} \/>/);
  assert.match(drivePage, /<BookingBand destination=\{laplandBooking\} \/>/);
  assert.match(drivePage, /data-booking-desk/);
  assert.match(drivePage, /data-featured-destination="lapland"/);
  assert.match(band, /data-booking-band/);
  assert.match(band, /id="go-there"/);
  assert.match(band, /出發 \/ Go there/);
  assert.match(band, /AVIASALES_SEARCH_URL/);
  assert.match(band, /HOTELLOOK_SEARCH_URL/);
  assert.match(band, /klookActivitiesUrl/);
  assert.match(band, /min-h-11/);
  assert.match(band, /origin_iata/);
  assert.match(band, /destination_iata/);
  assert.match(band, /HKG|originIata/);
  assert.match(band, /RVN|destinationIata/);
  assert.match(band, /HEL|extraIata/);
  assert.match(band, /name="destination"/);
  assert.match(disclosure, /部分連結可能是聯盟連結/);
  assert.match(disclosure, /Some links may be affiliate/);
  assert.match(disclosure, /The price does not increase/);
  assert.doesNotMatch(disclosure, /bg-amber-50/);
  assert.doesNotMatch(band, /<iframe/);
  assert.doesNotMatch(band, /widgetId/);
  assert.doesNotMatch(drivePage, /<iframe/);
  assert.doesNotMatch(drivePage, /travelpayouts-drive-widget/);
  assert.doesNotMatch(drivePage, /Next: search form/);
  assert.doesNotMatch(drivePage, /bg-amber-50/);
  assert.doesNotMatch(drivePage, /Drive 不是租車搜尋器/);
  assert.doesNotMatch(tripPage, /Writing guide/);
  assert.doesNotMatch(tripPage, /\/family\/capture/);
  assert.doesNotMatch(tripPage, /LaplandWinterPlan/);

  assert.equal(AVIASALES_SEARCH_URL, "https://www.aviasales.com/search");
  assert.equal(HOTELLOOK_SEARCH_URL, "https://search.hotellook.com/");
  assert.equal(KLOOK_SEARCH_URL, "https://www.klook.com/search/result/");
  assert.equal(laplandBooking.originIata, "HKG");
  assert.equal(laplandBooking.destinationIata, "RVN");
  assert.equal(laplandBooking.extraIata, "HEL");
  assert.equal(laplandBooking.city, "Rovaniemi");

  const flights = aviasalesSearchUrl("HKG", "RVN", "2027-01-18", "2027-01-25");
  const stays = hotellookSearchUrl("Rovaniemi", "2027-01-18", "2027-01-25");
  const activities = klookActivitiesUrl("Rovaniemi");
  assert.match(flights, /^https:\/\/www\.aviasales\.com\/search\?/);
  assert.match(flights, /origin_iata=HKG/);
  assert.match(flights, /destination_iata=RVN/);
  assert.match(stays, /^https:\/\/search\.hotellook\.com\/\?/);
  assert.match(stays, /destination=Rovaniemi/);
  assert.match(activities, /^https:\/\/www\.klook\.com\/search\/result\/\?/);
  assert.match(activities, /query=Rovaniemi/);
});

test("family and Capture sources never import the booking band or Drive script URL", async () => {
  const familyFiles = [
    "app/family/page.tsx",
    "app/family/family-unlock-panel.tsx",
    "app/family/capture/page.tsx",
    "app/trips/write/page.tsx",
    "app/trips/admin/page.tsx",
    "app/trips/new/page.tsx",
    "app/coffee/admin/page.tsx",
    "app/coffee/new/page.tsx",
    "app/admin/page.tsx",
  ];
  const pages = await Promise.all(familyFiles.map((path) => readFile(resolve(root, path), "utf8")));

  for (const html of pages) {
    assert.doesNotMatch(html, /emrldtp\.cc/);
    assert.doesNotMatch(html, /travelpayouts-drive/);
    assert.doesNotMatch(html, /BookingBand/);
    assert.doesNotMatch(html, /aviasales/);
    assert.doesNotMatch(html, /hotellook/);
    assert.doesNotMatch(html, /data-booking-band/);
  }
});

test("served family HTML omits Drive; public Lapland and Drive keep Drive plus booking links", async (t) => {
  const origin = process.env.TRAVELOS_HTML_ORIGIN;
  if (!origin) {
    t.skip("Set TRAVELOS_HTML_ORIGIN to fetch rendered HTML");
    return;
  }

  const base = origin.replace(/\/$/, "");
  const familyResponse = await fetch(`${base}/family`);
  assert.equal(familyResponse.ok, true);
  const familyHtml = await familyResponse.text();
  assert.match(familyHtml, /家庭編輯/);
  assert.doesNotMatch(familyHtml, /emrldtp\.cc/);
  assert.doesNotMatch(familyHtml, /travelpayouts-drive/);
  assert.doesNotMatch(familyHtml, /data-booking-band/);
  assert.doesNotMatch(familyHtml, /aviasales/);

  const captureResponse = await fetch(`${base}/family/capture`);
  assert.equal(captureResponse.ok, true);
  const captureHtml = await captureResponse.text();
  assert.doesNotMatch(captureHtml, /emrldtp\.cc/);
  assert.doesNotMatch(captureHtml, /travelpayouts-drive/);
  assert.doesNotMatch(captureHtml, /data-booking-band/);
  assert.doesNotMatch(captureHtml, /aviasales/);

  const laplandResponse = await fetch(`${base}${LAPLAND_JOURNAL_PATH}`);
  assert.equal(laplandResponse.ok, true);
  const laplandHtml = await laplandResponse.text();
  assert.match(laplandHtml, /emrldtp\.cc/);
  assert.match(laplandHtml, /travelpayouts-drive/);
  assert.match(laplandHtml, /https:\/\/emrldtp\.cc\/NTUwMzEz\.js\?t=550313/);
  assert.match(laplandHtml, /data-booking-band/);
  assert.match(laplandHtml, /aviasales\.com\/search/);
  assert.match(laplandHtml, /search\.hotellook\.com/);
  assert.match(laplandHtml, /klook\.com\/search\/result/);
  assert.match(laplandHtml, /出發 \/ Go there/);

  const driveResponse = await fetch(`${base}/drive`);
  assert.equal(driveResponse.ok, true);
  const driveHtml = await driveResponse.text();
  assert.match(driveHtml, /emrldtp\.cc/);
  assert.match(driveHtml, /travelpayouts-drive/);
  assert.match(driveHtml, /data-booking-band/);
  assert.match(driveHtml, /aviasales\.com\/search/);
  assert.match(driveHtml, /search\.hotellook\.com/);
  assert.match(driveHtml, /klook\.com\/search\/result/);
  assert.doesNotMatch(driveHtml, /bg-amber-50/);
  assert.doesNotMatch(driveHtml, /Drive 不是租車搜尋器/);
});
