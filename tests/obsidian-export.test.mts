import assert from "node:assert/strict";
import test from "node:test";
import { exportTripToObsidian } from "../lib/obsidian-export.ts";
import type { TripDetail } from "../lib/types.ts";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncObsidianSnapshot } from "../scripts/obsidian-sync.mts";

const trip = {
  id: "trip_kyushu", title: "九州", slug: "kyushu", summary: "家庭旅行",
  updatedAt: "2026-09-12T10:00:00Z", startDate: "2026-08-01", endDate: "2026-08-08",
  visibility: "private", journalEntries: [
    { id: "entry_plan", title: "安排", body: "原訂 A、B。\n\n**保留原文**", entryDate: "2026-08-01" },
    { id: "entry_actual", title: "當天", body: "最後只去了 E。", entryDate: "2026-08-01" },
  ], photos: [{ id: "photo_one", storageKey: "https://storage.example/photo?token=SECRET", takenAt: "2026-08-01T09:00:00Z" }],
} as TripDetail;

test("export preserves original paragraphs and distinguishes plans from confirmed experience", () => {
  const result = exportTripToObsidian(trip, { entryKinds: { entry_plan: "plan", entry_actual: "actual" } });
  assert.equal(result.filename, "trip_kyushu.md");
  assert.ok(result.markdown.includes('updated_at: "2026-09-12T10:00:00Z"'));
  assert.ok(result.markdown.includes("https://travelos2.chao-jason.workers.dev/trips/kyushu"));
  assert.ok(result.markdown.includes("## 行前計畫"));
  assert.ok(result.markdown.includes("## 已確認實際紀錄"));
  assert.ok(result.markdown.includes("原訂 A、B。\n\n**保留原文**"));
  assert.ok(result.markdown.includes("最後只去了 E。"));
  assert.ok(result.markdown.includes("photo_one"));
  assert.ok(!result.markdown.includes("SECRET"));
  assert.ok(!result.markdown.includes("storage.example"));
});

test("export never treats public visibility as proof of actual events and does not mutate source", () => {
  const source = structuredClone({ ...trip, visibility: "public" as const });
  const before = JSON.stringify(source);
  const first = exportTripToObsidian(source);
  assert.ok(first.markdown.includes("原始文稿（尚未核對計畫與實際）"));
  assert.ok(!first.markdown.includes("## 已確認實際紀錄"));
  assert.ok(first.markdown.includes('mirror_visibility: "private"'));
  assert.deepEqual(exportTripToObsidian(source), first);
  assert.equal(JSON.stringify(source), before);
  assert.equal(exportTripToObsidian({ ...source, title: "改名" }).filename, first.filename);
});

test("export filename cannot traverse folders and distinct IDs cannot collapse", () => {
  const first = exportTripToObsidian({ ...trip, id: "../a" });
  const second = exportTripToObsidian({ ...trip, id: "..\\a" });
  assert.ok(!/[\\/]/.test(first.filename));
  assert.notEqual(first.filename, second.filename);
});

test("export respects saved editorial classification and explicit overrides", () => {
  const classified = { ...trip, journalEntries: [{ ...trip.journalEntries[0], entryKind: "plan" as const }] };
  assert.ok(exportTripToObsidian(classified).markdown.includes("## 行前計畫"));
  const override = exportTripToObsidian(classified, { entryKinds: { entry_plan: "actual" } }).markdown;
  assert.ok(override.includes("## 已確認實際紀錄"));
  assert.ok(!override.includes("## 行前計畫"));
});

test("vault import is repeatable, preserves manual edits and retains older revisions", async () => {
  const directory = await mkdtemp(join(tmpdir(), "travelos-obsidian-"));
  try {
    const first = await syncObsidianSnapshot([trip], directory);
    assert.equal(first.created, 1);
    assert.equal((await syncObsidianSnapshot([trip], directory)).unchanged, 1);
    const filename = (await readdir(first.directory)).find(name => name.startsWith("trip_kyushu--"))!;
    await writeFile(join(first.directory, filename), "我的手寫補充");
    const conflict = await syncObsidianSnapshot([trip], directory);
    assert.equal(conflict.conflicts, 1);
    assert.equal(await readFile(join(first.directory, filename), "utf8"), "我的手寫補充");
    assert.equal((await syncObsidianSnapshot([{ ...trip, summary: "新版本" }], directory)).created, 1);
    assert.equal((await readdir(first.directory)).filter(name => name.startsWith("trip_kyushu--")).length, 2);
    assert.equal(await readFile(join(first.directory, ".gitignore"), "utf8"), "*\n");
  } finally {
    await rm(directory, { recursive: true });
  }
});
