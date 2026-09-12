import type { MomentPhoto } from "./types.ts";

export function photoProvenanceDisplay(photo: MomentPhoto) {
  const capture = photo.captureMetadataStatus === "verified" && photo.captureMetadata?.source === "exif" ? photo.captureMetadata : null;
  const local = capture?.localTakenAt;
  const captureTime = local && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(local)
    ? `${local.slice(0, 10)} ${local.slice(11, 16)}` : null;
  const uploaded = new Date(photo.createdAt);
  return {
    location: capture?.coordinates ? "拍攝位置已保留" : "拍攝地點待確認",
    captureTime: captureTime ? `拍攝 ${captureTime}` : "拍攝時間待確認",
    uploadTime: Number.isFinite(uploaded.getTime()) ? new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(uploaded) : null,
  };
}
