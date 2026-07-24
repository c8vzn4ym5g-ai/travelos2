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
