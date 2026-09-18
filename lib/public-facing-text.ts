/** Display-only. Stored journal text is not rewritten. */
export function hidePublicTimestamps(text: string): string {
  return text
    .replace(/\d{4}[./-]\d{1,2}[./-]\d{1,2}/g, "")
    .replace(/\d{1,2}\/\d{1,2}(?:\s*[–—-]\s*\d{1,2}\/\d{1,2})?/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/([。！？])\s*[，,、]+/g, "$1")
    .replace(/\s+([，。！？、])/g, "$1")
    .replace(/^[，,、\s]+|[，,、\s]+$/g, "")
    .trim();
}
