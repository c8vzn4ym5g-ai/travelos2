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

test("booking tools page explains affiliate behavior without a fake widget", async () => {
  const drivePage = await readFile(resolve(root, "app/drive/page.tsx"), "utf8");

  assert.match(drivePage, /聯盟連結揭露/);
  assert.match(drivePage, /Drive 不是租車搜尋器/);
  assert.doesNotMatch(drivePage, /travelpayouts-drive-widget/);
});
