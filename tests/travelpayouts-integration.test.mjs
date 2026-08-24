import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import {
  isPublicDrivePath,
  LAPLAND_COVER_PHOTO,
  LAPLAND_JOURNAL_PATH,
  PRIVATE_DRIVE_PATH_PREFIXES,
  travelpayoutsDriveHtml,
  TRAVELPAYOUTS_DRIVE_SCRIPT_URL,
} from "../lib/travelpayouts.ts";

const root = resolve(import.meta.dirname, "..");

async function read(path) {
  return readFile(resolve(root, path), "utf8");
}

test("Travelpayouts Drive keeps the registered script URL and a public-only pathname gate", async () => {
  const [layout, integration, middleware] = await Promise.all([
    read("app/layout.tsx"),
    read("components/travelpayouts-drive.tsx"),
    read("middleware.ts"),
  ]);

  assert.match(layout, /<TravelpayoutsDrive \/>/);
  assert.match(integration, /x-travelos-pathname/);
  assert.match(integration, /isPublicDrivePath/);
  assert.match(integration, /id="travelpayouts-drive"/);
  assert.match(middleware, /x-travelos-pathname/);
  assert.equal(TRAVELPAYOUTS_DRIVE_SCRIPT_URL, "https://emrldtp.cc/NTUwMzEz.js?t=550313");
  assert.match(integration, /https:\/\/emrldtp\.cc\/NTUwMzEz\.js\?t=550313/);
});

test("family HTML does not include emrldtp.cc / travelpayouts-drive", async () => {
  const familyFiles = [
    "app/family/page.tsx",
    "app/family/family-unlock-panel.tsx",
    "app/sana/page.tsx",
    "app/trips/admin/page.tsx",
    "app/coffee/admin/page.tsx",
    "app/trips/new/page.tsx",
    "app/coffee/new/page.tsx",
  ];
  const pages = await Promise.all(familyFiles.map((path) => read(path)));

  for (const html of pages) {
    assert.doesNotMatch(html, /emrldtp\.cc/);
    assert.doesNotMatch(html, /travelpayouts-drive/);
    assert.doesNotMatch(html, /聯盟連結/);
    assert.doesNotMatch(html, /Affiliate disclosure/);
    assert.doesNotMatch(html, /Travelpayouts/);
  }

  const familyBody = pages[0];
  const familyHtml = `<!DOCTYPE html><html><head>${travelpayoutsDriveHtml("/family")}</head><body>${familyBody}</body></html>`;
  const familyChildHtml = `<!DOCTYPE html><html><head>${travelpayoutsDriveHtml("/family/capture")}</head><body>${familyBody}</body></html>`;

  for (const html of [familyHtml, familyChildHtml, travelpayoutsDriveHtml("/family"), travelpayoutsDriveHtml("/sana")]) {
    assert.doesNotMatch(html, /emrldtp\.cc/);
    assert.doesNotMatch(html, /travelpayouts-drive/);
  }

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
  assert.doesNotMatch(familyHtml, /emrldtp\.cc/);
  assert.doesNotMatch(familyHtml, /travelpayouts-drive/);
  assert.doesNotMatch(familyHtml, /聯盟連結/);
  assert.doesNotMatch(familyHtml, /Affiliate disclosure/);

  const driveResponse = await fetch(`${origin.replace(/\/$/, "")}/drive`);
  assert.equal(driveResponse.ok, true);
  const driveHtml = await driveResponse.text();
  assert.match(driveHtml, /emrldtp\.cc/);
  assert.match(driveHtml, /travelpayouts-drive/);
  assert.match(driveHtml, /策劃拉普蘭冬旅/);
  assert.match(driveHtml, /finland-lapland-winter-journal-2020/);
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
    ...PRIVATE_DRIVE_PATH_PREFIXES,
  ]) {
    assert.equal(isPublicDrivePath(path), false, path);
  }

  for (const path of ["/", "/trips", LAPLAND_JOURNAL_PATH, "/drive", "/coffee"]) {
    assert.equal(isPublicDrivePath(path), true, path);
  }
});

test("booking desk is a public Lapland planning page without fake widgets", async () => {
  const [drivePage, disclosure] = await Promise.all([
    read("app/drive/page.tsx"),
    read("components/affiliate-disclosure.tsx"),
  ]);

  assert.match(drivePage, /data-booking-desk/);
  assert.match(drivePage, /data-featured-destination="lapland"/);
  assert.match(drivePage, /finland-lapland-winter-journal-2020/);
  assert.match(drivePage, /Flights \/ 航班/);
  assert.match(drivePage, /Stays \/ 住宿/);
  assert.match(drivePage, /Things to do \/ 活動/);
  assert.match(drivePage, /Transport \/ 當地交通/);
  assert.match(drivePage, /Rovaniemi/);
  assert.match(drivePage, /Helsinki/);
  assert.match(drivePage, /Santa Claus Village/);
  assert.match(drivePage, /AffiliateDisclosure/);
  assert.match(drivePage, /drivePageMetadata/);
  assert.match(disclosure, /聯盟連結揭露/);
  assert.match(disclosure, /Drive 不是租車搜尋器/);
  assert.match(disclosure, /Some links may be affiliate/);
  assert.match(disclosure, /The price does not increase/);
  assert.doesNotMatch(drivePage, /Next: search form/);
  assert.doesNotMatch(drivePage, /Visual preview coming soon/);
  assert.doesNotMatch(drivePage, /travelpayouts-drive-widget/);
  assert.doesNotMatch(drivePage, /<iframe/);
  assert.doesNotMatch(drivePage, /widgetId/);
});

test("public Lapland journal adds a native winter planning block after the journal", async () => {
  const [tripPage, plan, home] = await Promise.all([
    read("app/trips/[slug]/page.tsx"),
    read("components/lapland-winter-plan.tsx"),
    read("app/page.tsx"),
  ]);

  assert.match(tripPage, /id="journal"/);
  assert.match(tripPage, /<LaplandWinterPlan \/>/);
  assert.match(tripPage, /laplandTripMetadata/);
  const afterJournal = tripPage.slice(tripPage.indexOf('id="journal"'));
  assert.match(afterJournal, /<LaplandWinterPlan \/>/);
  assert.match(plan, /策劃這樣的冬旅 \/ Plan a winter like this/);
  assert.match(plan, /Rovaniemi/);
  assert.match(plan, /Helsinki/);
  assert.match(plan, /Santa Claus Village/);
  assert.match(plan, /snow cabin/);
  assert.match(plan, /Arctic Circle/);
  assert.match(plan, /AffiliateDisclosure/);
  assert.match(plan, /min-h-11/);
  assert.doesNotMatch(plan, /<iframe/);
  assert.doesNotMatch(plan, /Writing guide/);
  assert.doesNotMatch(tripPage, /Writing guide/);
  assert.doesNotMatch(tripPage, /\/family\/capture/);
  assert.doesNotMatch(home, /href="\/drive"[\s\S]{0,800}Visual preview coming soon/);
  assert.match(home, /LAPLAND_COVER_PHOTO|\/travelos\/lapland\//);
  assert.match(home, /sessionPhotosByHref/);
  assert.match(home, /"\/drive": drivePhotoStrip/);
});

test("public SEO copy is unique on Lapland and Drive, not on family", async () => {
  const [tripPage, drivePage, family, robots, sitemap] = await Promise.all([
    read("app/trips/[slug]/page.tsx"),
    read("app/drive/page.tsx"),
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
