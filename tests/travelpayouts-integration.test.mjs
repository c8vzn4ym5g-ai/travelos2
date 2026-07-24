import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("Travelpayouts Drive loads once at the public app boundary", async () => {
  const [layout, integration, drivePage] = await Promise.all([
    readFile(resolve(root, "app/layout.tsx"), "utf8"),
    readFile(resolve(root, "components/travelpayouts-drive.tsx"), "utf8"),
    readFile(resolve(root, "app/drive/page.tsx"), "utf8"),
  ]);

  assert.match(layout, /<TravelpayoutsDrive \/>/);
  assert.match(integration, /https:\/\/emrldtp\.cc\/NTUwMzEz\.js\?t=550313/);
  assert.match(integration, /id="travelpayouts-drive"/);
  assert.doesNotMatch(drivePage, /<Script/);
});

test("booking tools page explains affiliate behavior without a fake widget", async () => {
  const drivePage = await readFile(resolve(root, "app/drive/page.tsx"), "utf8");

  assert.match(drivePage, /聯盟連結揭露/);
  assert.match(drivePage, /Drive 不是租車搜尋器/);
  assert.doesNotMatch(drivePage, /travelpayouts-drive-widget/);
});
