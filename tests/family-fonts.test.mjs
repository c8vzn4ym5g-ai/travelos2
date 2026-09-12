import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("family font rendering requires no remote font build or runtime request", async () => {
  const layout = await readFile(new URL("../app/family/layout.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/family/family.css", import.meta.url), "utf8");
  assert.doesNotMatch(layout, /next\/font|https?:/);
  const family = css.slice(css.indexOf('[data-surface="family"] {'), css.indexOf("}"));
  for (const role of ["rounded", "nunito", "caveat"]) assert.match(family, new RegExp(`--font-fam-${role}:`));
  assert.match(family, /system-ui/);
  assert.doesNotMatch(css, /@import|@font-face|fonts\.googleapis/);
  assert.match(layout, /data-surface="family"/);
});
