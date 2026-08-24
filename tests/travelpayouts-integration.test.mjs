import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  AVIASALES_SEARCH_URL,
  aviasalesSearchUrl,
  HOTELLOOK_SEARCH_URL,
  hotellookSearchUrl,
  isPublicDrivePath,
  KLOOK_SEARCH_URL,
  klookActivitiesUrl,
  LAPLAND_JOURNAL_PATH,
  laplandBooking,
  PRIVATE_DRIVE_PATH_PREFIXES,
  travelpayoutsDriveHtml,
  TRAVELPAYOUTS_DRIVE_SCRIPT_URL,
} from "../lib/travelpayouts.ts";

const root = resolve(import.meta.dirname, "..");

async function read(path) {
  return readFile(resolve(root, path), "utf8");
}

test("Travelpayouts Drive keeps the registered script URL and a public-only pathname gate", async () => {
  const [layout, rootLayout, integration, middleware, helper] = await Promise.all([
    read("app/(public)/layout.tsx"),
    read("app/layout.tsx"),
    read("components/travelpayouts-drive.tsx"),
    read("middleware.ts"),
    read("lib/travelpayouts.ts"),
  ]);

  assert.match(layout, /<TravelpayoutsDrive \/>/);
  assert.doesNotMatch(rootLayout, /TravelpayoutsDrive/);
  assert.match(integration, /x-travelos-pathname/);
  assert.match(integration, /isPublicDrivePath/);
  assert.match(integration, /id="travelpayouts-drive"/);
  assert.match(integration, /TRAVELPAYOUTS_DRIVE_SCRIPT_URL/);
  assert.match(middleware, /x-travelos-pathname/);
  assert.equal(TRAVELPAYOUTS_DRIVE_SCRIPT_URL, "https://emrldtp.cc/NTUwMzEz.js?t=550313");
  assert.match(helper, /https:\/\/emrldtp\.cc\/NTUwMzEz\.js\?t=550313/);
});

test("family HTML does not include emrldtp.cc / travelpayouts-drive", async () => {
  const familyFiles = [
    "app/family/page.tsx",
    "app/family/family-unlock-panel.tsx",
    "app/family/capture/page.tsx",
    "app/sana/page.tsx",
    "app/trips/admin/page.tsx",
    "app/coffee/admin/page.tsx",
    "app/trips/new/page.tsx",
    "app/coffee/new/page.tsx",
    "app/trips/write/page.tsx",
    "app/layout.tsx",
  ];
  const pages = await Promise.all(familyFiles.map((path) => read(path)));

  for (const html of pages) {
    assert.doesNotMatch(html, /emrldtp\.cc/);
    assert.doesNotMatch(html, /travelpayouts-drive/);
    assert.doesNotMatch(html, /聯盟連結/);
    assert.doesNotMatch(html, /Affiliate disclosure/);
    assert.doesNotMatch(html, /Travelpayouts/);
    assert.doesNotMatch(html, /BookingBand/);
    assert.doesNotMatch(html, /aviasales/);
  }

  const familyBody = pages[0];
  const familyHtml = `<!DOCTYPE html><html><head>${travelpayoutsDriveHtml("/family")}</head><body>${familyBody}</body></html>`;
  const familyChildHtml = `<!DOCTYPE html><html><head>${travelpayoutsDriveHtml("/family/capture")}</head><body>${familyBody}</body></html>`;
  const writeHtml = `<!DOCTYPE html><html><head>${travelpayoutsDriveHtml("/trips/write")}</head><body>${pages[8]}</body></html>`;

  for (const html of [
    familyHtml,
    familyChildHtml,
    writeHtml,
    travelpayoutsDriveHtml("/family"),
    travelpayoutsDriveHtml("/family/capture"),
    travelpayoutsDriveHtml("/sana"),
    travelpayoutsDriveHtml("/trips/write"),
  ]) {
    assert.doesNotMatch(html, /emrldtp\.cc/);
    assert.doesNotMatch(html, /travelpayouts-drive/);
  }

  assert.match(familyBody, /href="\/family\/capture"/);
  assert.match(familyBody, /打開 Capture/);

  const publicHtml = travelpayoutsDriveHtml(LAPLAND_JOURNAL_PATH);
  assert.match(publicHtml, /emrldtp\.cc/);
  assert.match(publicHtml, /id="travelpayouts-drive"/);
});

test("served family HTML omits Drive when a local origin is available", async (t) => {
  const origin = process.env.TRAVELOS_HTML_ORIGIN;
  if (!origin) {
    t.skip("Set TRAVELOS_HTML_ORIGIN to fetch rendered family HTML");
    return;
  }

  const familyResponse = await fetch(`${origin.replace(/\/$/, "")}/family`);
  assert.equal(familyResponse.ok, true);
  const familyHtml = await familyResponse.text();
  assert.match(familyHtml, /家庭編輯/);
  assert.match(familyHtml, /打開 Capture/);
  assert.doesNotMatch(familyHtml, /emrldtp\.cc/);
  assert.doesNotMatch(familyHtml, /travelpayouts-drive/);
  assert.doesNotMatch(familyHtml, /聯盟連結/);
  assert.doesNotMatch(familyHtml, /aviasales/);
  assert.doesNotMatch(familyHtml, /data-booking-band/);

  const captureResponse = await fetch(`${origin.replace(/\/$/, "")}/family/capture`);
  assert.equal(captureResponse.ok, true);
  const captureHtml = await captureResponse.text();
  assert.doesNotMatch(captureHtml, /emrldtp\.cc/);
  assert.doesNotMatch(captureHtml, /travelpayouts-drive/);
  assert.doesNotMatch(captureHtml, /data-booking-band/);
  assert.doesNotMatch(captureHtml, /aviasales/);

  const driveResponse = await fetch(`${origin.replace(/\/$/, "")}/drive`);
  assert.equal(driveResponse.ok, true);
  const driveHtml = await driveResponse.text();
  assert.match(driveHtml, /emrldtp\.cc/);
  assert.match(driveHtml, /travelpayouts-drive/);
  assert.match(driveHtml, /data-booking-band/);
  assert.match(driveHtml, /aviasales\.com\/search/);
  assert.match(driveHtml, /search\.hotellook\.com/);
  assert.match(driveHtml, /klook\.com\/search\/result/);
});

test("Drive stays off family, PIN, and draft editor pathnames", () => {
  for (const path of [
    "/family",
    "/family/capture",
    "/sana",
    "/trips/admin",
    "/coffee/admin",
    "/trips/new",
    "/coffee/new",
    "/trips/write",
    ...PRIVATE_DRIVE_PATH_PREFIXES,
  ]) {
    assert.equal(isPublicDrivePath(path), false, path);
  }

  for (const path of ["/", "/trips", LAPLAND_JOURNAL_PATH, "/drive", "/coffee"]) {
    assert.equal(isPublicDrivePath(path), true, path);
  }
});

test("public trip and Drive contain a working BookingBand with real brand hrefs", async () => {
  const [tripPage, drivePage, band, disclosure] = await Promise.all([
    read("app/(public)/trips/[slug]/page.tsx"),
    read("app/(public)/drive/page.tsx"),
    read("components/booking-band.tsx"),
    read("components/affiliate-disclosure.tsx"),
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

test("home presents the public journal as the viewer hero", async () => {
  const home = await read("app/(public)/page.tsx");

  assert.match(home, /拉普蘭冬日遊記/);
  assert.match(home, /LAPLAND_JOURNAL_PATH/);
  assert.match(home, /家庭編輯/);
  assert.match(home, /"\/drive": drivePhotoStrip/);
  assert.doesNotMatch(home, /Your travel and coffee memory system/);
  assert.doesNotMatch(home, /bg-emerald-700[\s\S]{0,80}家庭編輯/);
});

test("public SEO copy is unique on Lapland and Drive, not on family", async () => {
  const [tripPage, drivePage, family, robots, sitemap] = await Promise.all([
    read("app/(public)/trips/[slug]/page.tsx"),
    read("app/(public)/drive/page.tsx"),
    read("app/family/page.tsx"),
    read("app/robots.ts"),
    read("app/sitemap.ts"),
  ]);

  assert.match(tripPage, /laplandTripMetadata/);
  assert.match(drivePage, /drivePageMetadata/);
  assert.match(family, /家庭編輯 \/ Family workspace/);
  assert.doesNotMatch(family, /聯盟連結/);
  assert.doesNotMatch(family, /affiliate/i);
  assert.match(robots, /\/family/);
  assert.match(robots, /\/drive/);
  assert.match(sitemap, /\/drive/);
});
