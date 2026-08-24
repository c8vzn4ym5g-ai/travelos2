import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("primary mobile navigation exposes reliable touch targets", async () => {
  const [home, family] = await Promise.all([
    readFile(resolve(root, "app/page.tsx"), "utf8"),
    readFile(resolve(root, "app/family/page.tsx"), "utf8"),
  ]);

  assert.match(home, /min-h-11/);
  assert.match(family, /min-h-11/);
});

test("the installable app supports both portrait and landscape use", async () => {
  const manifest = await readFile(resolve(root, "app/manifest.ts"), "utf8");

  assert.doesNotMatch(manifest, /orientation:\s*"portrait"/);
});

test("core travel, coffee, booking, and editor routes keep touch controls at 44px", async () => {
  const routeSources = await Promise.all(
    [
      "app/trips/page.tsx",
      "app/coffee/page.tsx",
      "app/drive/page.tsx",
      "app/trips/admin/page.tsx",
      "app/coffee/admin/page.tsx",
      "app/family/capture/page.tsx",
      "app/trips/write/page.tsx",
    ].map((path) => readFile(resolve(root, path), "utf8")),
  );

  for (const source of routeSources) {
    assert.match(source, /min-h-11/);
  }

  assert.match(routeSources[4], /min-w-11/);
});

test("family workspace exposes its shared unlock form without dark content boxes", async () => {
  const family = await readFile(resolve(root, "app/family/page.tsx"), "utf8");
  const unlockPanel = await readFile(resolve(root, "app/family/family-unlock-panel.tsx"), "utf8");

  assert.match(family, /FamilyUnlockPanel/);
  assert.match(unlockPanel, /輸入家庭編輯密碼/);
  assert.match(unlockPanel, /type=\{showPin \? "text" : "password"\}/);
  assert.match(unlockPanel, /顯示密碼/);
  assert.match(unlockPanel, /隱藏密碼/);
  assert.match(unlockPanel, /aria-pressed=\{showPin\}/);
  assert.match(unlockPanel, /前往旅行編輯/);
  assert.match(unlockPanel, /前往咖啡編輯/);
  assert.doesNotMatch(family, /bg-zinc-950/);
  assert.doesNotMatch(family, /bg-emerald-800/);
});

test("family workspace is the only PIN entry and department editors redirect upward", async () => {
  const [travelAdmin, coffeeAdmin] = await Promise.all([
    readFile(resolve(root, "app/trips/admin/page.tsx"), "utf8"),
    readFile(resolve(root, "app/coffee/admin/page.tsx"), "utf8"),
  ]);

  for (const editor of [travelAdmin, coffeeAdmin]) {
    assert.match(editor, /router\.replace\("\/family"\)/);
    assert.doesNotMatch(editor, /function verifyPin/);
    assert.doesNotMatch(editor, /type="password"/);
    assert.doesNotMatch(editor, />Admin PIN</);
  }
});
