import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("cf:build passes OpenNext the unsupported-Next escape hatch", async () => {
  const packageApp = await readFile(resolve(root, "scripts/package-app.mjs"), "utf8");
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  assert.match(packageApp, /--dangerouslyUseUnsupportedNextVersion/);
  assert.match(packageApp, /opennextjs-cloudflare/);
  assert.match(packageApp, /node_modules\/next\/dist\/bin\/next/);
  assert.equal(pkg.scripts["cf:build"], "node scripts/package-app.mjs --cloudflare");
  assert.match(pkg.scripts["cf:preview"], /--dangerouslyUseUnsupportedNextVersion/);
  assert.match(pkg.scripts["cf:deploy"], /--dangerouslyUseUnsupportedNextVersion/);
  assert.doesNotMatch(pkg.scripts.build, /opennextjs-cloudflare/);
});
