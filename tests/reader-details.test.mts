import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

test("reference content mounts only after opening, and can be closed again", async () => {
  const source = await readFile(new URL("../components/reader-details.tsx", import.meta.url), "utf8");
  let open = false;
  const react = { useState: () => [open, (update: (value: boolean) => boolean) => { open = update(open); }] };
  const modules: Record<string, any> = { react, "react/jsx-runtime": { jsx, jsxs } };
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((id: string) => modules[id], exports);
  let mapMounts = 0;
  function MapProbe() { mapMounts++; return createElement("div", { "data-test-map": "" }, "MAP"); }
  const render = () => exports.ReaderDetails({ title: "地圖與行程參考", children: createElement(MapProbe) });
  let view = render();
  assert.equal(view.props.children[1], null);
  assert.equal(view.props.children[0].props["aria-expanded"], false);
  assert.doesNotMatch(renderToStaticMarkup(view), /data-test-map/);
  assert.equal(mapMounts, 0);
  view.props.children[0].props.onClick();
  view = render();
  assert.match(renderToStaticMarkup(view), /data-test-map/);
  assert.equal(mapMounts, 1);
  assert.equal(view.props.children[0].props["aria-expanded"], true);
  view.props.children[0].props.onClick();
  assert.equal(render().props.children[1], null);
  assert.doesNotMatch(renderToStaticMarkup(render()), /data-test-map/);
  assert.equal(mapMounts, 1);
});

test("general story precedes optional map and cost references, without visible internal photo captions", async () => {
  const page = await readFile(new URL("../app/trips/[slug]/page.tsx", import.meta.url), "utf8");
  const story = page.indexOf('aria-label="旅程故事"');
  const reference = page.indexOf('<ReaderDetails title="地圖與行程參考">');
  assert.ok(story > 0 && reference > story);
  assert.ok(page.indexOf('<ReaderDetails title="旅費紀錄">') > reference);
  assert.ok(page.includes('{isLapland ? <section className="travel-panel rounded-2xl p-4 sm:p-5">'));
  assert.ok(page.includes('getTripPromoVideos(trip.slug).length === 0'));
  const storyBlock = page.slice(story, page.indexOf('<ReaderAlbum photos=', story));
  assert.ok(storyBlock.includes('<NarrativeBody body={entry.body}'));
  assert.equal(storyBlock.includes('<figcaption'), false);
  assert.ok(storyBlock.includes('href={`#story-${entry.id}`}'));
  assert.ok(storyBlock.includes('id={`story-${entry.id}`}'));
});
