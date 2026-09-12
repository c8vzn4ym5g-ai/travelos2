import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, lstat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { exportTripToObsidian } from "../lib/obsidian-export.ts";
import type { TripDetail } from "../lib/types.ts";

const SOURCE = "https://travelos2.chao-jason.workers.dev/api/trips/content";
const DEFAULT_PROJECT = "C:/Users/chao_/Documents/Codex/2026-07-19/referenced-chatgpt-conversation-this-is-untrusted/JDB-Runtime/projects/travel-os";
const digest = (text: string) => createHash("sha256").update(text).digest("hex");

/** Immutable revisions: existing files, including manual edits, are never overwritten. */
export async function syncObsidianSnapshot(trips: TripDetail[], projectDirectory: string, source?: { kind: string; updatedAt?: string }) {
  const directory = join(resolve(projectDirectory), "generated");
  await mkdir(directory, { recursive: true });
  if ((await lstat(directory)).isSymbolicLink()) throw new Error("Generated folder cannot be a link");
  const counts = { created: 0, unchanged: 0, conflicts: 0, trips: trips.length, directory };
  const saveNew = async (name: string, body: string) => {
    try {
      await writeFile(join(directory, name), body, { encoding: "utf8", flag: "wx" });
      return "created" as const;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const stat = await lstat(join(directory, name));
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Generated destination is not a regular file");
      return await readFile(join(directory, name), "utf8") === body ? "unchanged" as const : "conflicts" as const;
    }
  };
  // Private mirrors must remain outside Git, including any nested revision files.
  if (await saveNew(".gitignore", "*\n") === "conflicts") throw new Error("Existing generated .gitignore differs; no content imported");
  const links: string[] = [];
  for (const trip of trips) {
    const exported = exportTripToObsidian(trip);
    const name = `${exported.filename.slice(0, -3)}--${digest(exported.markdown)}.md`;
    counts[await saveNew(name, exported.markdown)] += 1;
    links.push(`- [${trip.title.replace(/[\[\]\r\n]/g, " ")}](${name}) — ${trip.updatedAt}`);
  }
  const index = ["# TravelOS 雲端匯入", "", `來源：${source?.kind ?? "提供的快照"}；來源內容時間：${source?.updatedAt ?? "依各篇 updated_at"}`, "", "這是私人、單向、按需匯入。手機上傳與簡單編輯不需要 notebook 開機。", "", "人工筆記請另存並連結本文；新版本另建檔案，不覆蓋任何既有內容。", "", ...links, ""].join("\n");
  const indexName = `匯入目錄--${digest(index)}.md`;
  await saveNew(indexName, index);
  return { ...counts, index: join(directory, indexName) };
}

async function main() {
  const snapshotPath = process.argv[2] === "--snapshot" ? process.argv[3] : undefined;
  if (process.argv.length > 2 && (!snapshotPath || process.argv.length !== 4)) throw new Error("Usage: obsidian-sync.mts [--snapshot saved-content.json]");
  let raw: unknown;
  if (snapshotPath) raw = JSON.parse(await readFile(resolve(snapshotPath), "utf8"));
  else {
    const response = await fetch(SOURCE, { signal: AbortSignal.timeout(120_000), headers: process.env.TRAVELOS_ADMIN_PIN ? { "x-travelos-admin-pin": process.env.TRAVELOS_ADMIN_PIN } : {} });
    if (!response.ok) throw new Error(`Cloud read failed (${response.status}); no import performed`);
    raw = await response.json();
  }
  const payload = raw as { content?: { trips?: TripDetail[]; updatedAt?: string }; status?: { source?: string } };
  if (!Array.isArray(payload.content?.trips) || !payload.content.trips.length || payload.status?.source === "seed") throw new Error("Cloud snapshot unavailable; refusing seed-only or empty import");
  const result = await syncObsidianSnapshot(payload.content.trips, process.env.TRAVELOS_OBSIDIAN_PROJECT || DEFAULT_PROJECT, { kind: snapshotPath ? "已保存雲端快照（非即時）" : "即時雲端讀取", updatedAt: payload.content.updatedAt });
  console.log(JSON.stringify({ ...result, source: snapshotPath ? "saved-cloud-snapshot" : "live-cloud" }));
  if (result.conflicts) process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "Import failed"); process.exitCode = 1; });
}
