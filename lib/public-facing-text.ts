/** Display-only. Stored journal text is not rewritten. */
const isoDate = "\\d{4}[./-]\\d{1,2}[./-]\\d{1,2}";
const slashDate = "\\d{1,2}/\\d{1,2}";
const stamp = new RegExp(
  `${isoDate}(?:\\s*[–—-]\\s*(?:\\d{4}[./-])?\\d{1,2}(?:[./-]\\d{1,2})?)?|${slashDate}(?:\\s*[–—-]\\s*(?:\\d{1,2}/)?\\d{1,2})?`,
  "g",
);

export function hidePublicTimestamps(text: string): string {
  return text
    .replace(stamp, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([。！？])\s*[，,、]+/g, "$1")
    .replace(/\s+([，。！？、])/g, "$1")
    .replace(/^[，,、\s]+|[，,、\s]+$/g, "")
    .trim();
}
