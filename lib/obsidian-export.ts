import type { TripDetail } from "./types";

export type ObsidianEntryKind = "plan" | "actual" | "public" | "unreviewed";
export type ObsidianExportOptions = {
  /** Classification must come from editorial confirmation, never title inference. */
  entryKinds?: Record<string, ObsidianEntryKind>;
};

/** A private, one-way reading mirror. No filesystem, network or cloud mutation. */
export function exportTripToObsidian(trip: TripDetail, options: ObsidianExportOptions = {}) {
  const sourceUrl = `https://travelos2.chao-jason.workers.dev/trips/${encodeURIComponent(trip.slug)}`;
  const sections: [ObsidianEntryKind, string][] = [
    ["plan", "行前計畫"], ["actual", "已確認實際紀錄"],
    ["public", "已整理公開文稿"], ["unreviewed", "原始文稿（尚未核對計畫與實際）"],
  ];
  const lines = [
    "---", "travelos_generated: true", "bridge_version: 1",
    `trip_id: ${JSON.stringify(trip.id)}`,
    `updated_at: ${JSON.stringify(trip.updatedAt)}`,
    `source_url: ${JSON.stringify(sourceUrl)}`,
    `source_visibility: ${JSON.stringify(trip.visibility)}`,
    'mirror_visibility: "private"', "---", "",
    `# ${trip.title}`, "",
    "> TravelOS 單向鏡像。人工補充請另建筆記並連結本頁；重新匯出不會合併手寫內容。", "",
    `來源：[開啟 TravelOS](${sourceUrl})（私人旅程可能需要家庭存取權限）`, "",
    `旅程日期：${trip.startDate} — ${trip.endDate}`, "", trip.summary, "",
  ];
  for (const [kind, title] of sections) {
    const entries = trip.journalEntries.filter(entry => (options.entryKinds?.[entry.id] ?? entry.entryKind ?? "unreviewed") === kind);
    if (!entries.length) continue;
    lines.push(`## ${title}`, "");
    for (const entry of entries) {
      lines.push(`### ${entry.title}`, "", `紀錄 ID：${JSON.stringify(entry.id)}｜日期：${entry.entryDate}`, "", entry.body, "");
    }
  }
  lines.push("## 照片索引", "", "保留照片 ID 與拍攝時間供對照；原檔仍在雲端，不複製帶憑證的媒體網址。", "");
  for (const photo of trip.photos) {
    lines.push(`- 照片 ID：${JSON.stringify(photo.id)}；拍攝時間：${photo.takenAt || "未知（不以上傳時間替代）"}`);
  }
  // Hex encoding is reversible, filesystem-safe, and avoids ID sanitization collisions.
  const safeId = /^[a-zA-Z0-9_-]+$/.test(trip.id) && !trip.id.startsWith("encoded-")
    ? trip.id : `encoded-${Array.from(new TextEncoder().encode(trip.id), byte => byte.toString(16).padStart(2, "0")).join("")}`;
  return { filename: `${safeId}.md`, markdown: `${lines.join("\n")}\n` };
}
