import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");

test("homepage featured strip uses first-glance promo copy and the public journal href", async () => {
  const home = await readFile(resolve(root, "app/page.tsx"), "utf8");

  assert.match(home, /FEATURED_JOURNAL_KICKER = "十二月 · 深冬 \/ December · midwinter"/);
  assert.match(home, /FEATURED_JOURNAL_TITLE = "北極圈上的十二月 \/ December on the Arctic Circle"/);
  assert.match(home, /FEATURED_JOURNAL_DEK_ZH = "廣場上有一條線。走過去，就是北極圈。"/);
  assert.match(home, /FEATURED_JOURNAL_DEK_EN = "A line in the square you can walk across."/);
  assert.match(home, /FEATURED_JOURNAL_CTA = "打開這趟 \/ Open this trip"/);
  assert.match(home, /href=\{LAPLAND_JOURNAL_PATH\}/);
  assert.match(home, /description: FEATURED_JOURNAL_DEK/);
  assert.match(home, /title: FEATURED_JOURNAL_TITLE/);
  assert.match(home, /cover_IMG_3619/);
  assert.doesNotMatch(home, /現在公開 \/ Now public/);
  assert.doesNotMatch(home, /打開遊記 \/ Open the journal/);
  assert.doesNotMatch(home, /十二月。深冬。白晝只剩兩三小時。/);
  assert.doesNotMatch(home, /Two or three hours of daylight/);
});
