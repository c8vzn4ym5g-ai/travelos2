import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import ts from "typescript";
import { coordinateReaderPlayback } from "../lib/reader-playback.ts";

test("starting video pauses music; starting music pauses Lapland video; cleanup detaches", () => {
  const media = [
    { paused: false, pauses: 0, matches: () => true, pause() { this.paused = true; this.pauses++; } },
    { paused: false, pauses: 0, matches: () => true, pause() { this.paused = true; this.pauses++; } },
  ];
  let listener: ((event: any) => void) | undefined;
  const root = {
    addEventListener(event: string, callback: any, capture: boolean) {
      assert.equal(event, "play"); assert.equal(capture, true); listener = callback;
    },
    removeEventListener(event: string, callback: any, capture: boolean) {
      assert.equal(event, "play"); assert.equal(callback, listener); assert.equal(capture, true); listener = undefined;
    },
    querySelectorAll: () => media,
  };
  const dispose = coordinateReaderPlayback(root as unknown as Document);
  listener!({ target: media[0] });
  assert.equal(media[0].paused, false);
  assert.equal(media[1].paused, true);
  media[1].paused = false;
  listener!({ target: media[1] });
  assert.equal(media[0].paused, true);
  assert.equal(media[1].paused, false);
  dispose();
  assert.equal(listener, undefined);
});

test("film version buttons select the matching source and recover after a failed version", async () => {
  const source = await readFile(new URL("../components/reader-media.tsx", import.meta.url), "utf8");
  const states: any[] = [];
  let cursor = 0;
  const react = { useState(initial: any) {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], (value: any) => { states[index] = value; }];
  } };
  const jsx = (type: any, props: any, key: any) => ({ type, props, key });
  const modules: Record<string, any> = { react, "react/jsx-runtime": { jsx, jsxs: jsx }, "@/lib/trip-photo": {} };
  const code = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: any = {};
  new Function("require", "exports", code)((name: string) => modules[name], exports);
  const videos = [{ title: "原有路線版", src: "/a.mp4" }, { title: "原有生活版", src: "/b.mp4" }];
  const render = () => { cursor = 0; return exports.ReaderFilm({ videos }); };
  function all(node: any): any[] {
    if (!node || typeof node !== "object") return [];
    if (Array.isArray(node)) return node.flatMap(all);
    return [node, ...all(node.props?.children)];
  }
  let nodes = all(render());
  assert.equal(nodes.find(n => n.type === "video").props.src, "/a.mp4");
  let buttons = nodes.filter(n => n.type === "button");
  assert.deepEqual(buttons.map(b => b.props.children), videos.map(v => v.title));
  buttons[1].props.onClick();
  nodes = all(render());
  const second = nodes.find(n => n.type === "video");
  assert.equal(second.props.src, "/b.mp4");
  assert.equal(second.key, "/b.mp4");
  assert.equal(second.props.preload, "none");
  assert.equal(nodes.filter(n => n.type === "button")[1].props["aria-pressed"], true);
  second.props.onError();
  nodes = all(render());
  assert.equal(nodes.some(n => n.type === "video"), false);
  assert.ok(nodes.find(n => n.props?.role === "status"));
  nodes.filter(n => n.type === "button")[0].props.onClick();
  assert.equal(all(render()).find(n => n.type === "video").props.src, "/a.mp4");
});

test("music pause updates the visible on/off control and listener covers standalone hero", async () => {
  const source = await readFile(new URL("../components/journey-music-player.tsx", import.meta.url), "utf8");
  assert.ok(source.includes("coordinateReaderPlayback(document)"));
  assert.ok(source.includes('data-journey-audio=""'));
  assert.ok(source.includes("onPause={() => setIsOn(false)}"));
});
