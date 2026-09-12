import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../app/trips/page.tsx", import.meta.url), "utf8");
const card = source.slice(source.indexOf("function TripCard("), source.indexOf("export default async function TripsPage"));
const forms = [...card.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/g)];

for (const [entry, content] of [
  ["Open details CTA", /\{ui\.read\}/],
  ["title", /\{trip\.title\}/],
  ["cover", /<img\b/],
]) {
  test(`trip card ${entry} submits a native GET form to the trip URL`, () => {
    const form = forms.find((match) => content.test(match[2]));
    assert.ok(form, `${entry} must be inside a native form`);
    assert.match(form[1], /action=\{href\}/);
    assert.match(form[1], /method="get"/);
    const button = form[2].match(/<button\b([^>]*)>([\s\S]*?)<\/button>/);
    assert.ok(button, `${entry} must be a button`);
    assert.match(button[1], /type="submit"/);
    assert.match(button[2], content);
    if (entry === "Open details CTA") assert.match(button[1], /travel-primary/);
  });
}

test("trip card entry points do not use Next.js links or intercepted submissions", () => {
  assert.match(source, /return `\/trips\/\$\{trip\.slug\}`/);
  assert.match(card, /const href = articleHref\(trip\)/);
  assert.doesNotMatch(card, /<Link\b|onSubmit\s*=|onClick\s*=/);
  assert.doesNotMatch(source, /import\s+.*from\s+["']next\/(?:link|form)["']/);
  assert.match(source, /read: "\\u95b1\\u8b80 \/ Open details"/);
});
