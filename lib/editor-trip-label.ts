/** Native `<select>` option text for 遊記編輯. */

export function editorTripPickerDate(startDate: string | null | undefined) {
  return (startDate ?? "").trim().slice(0, 10);
}

/**
 * Keep the warehouse title as-is. Do not run series stripping here —
 * `stripSeriesFromTitle` is for `爱慕虚荣团 ·` prefixes, not journal names
 * like `北極圈上的十二月`.
 *
 * Dated: `北極圈上的十二月 | 2019-12-11`
 * No date: `東京走走` — never a trailing ` |`.
 */
export function formatEditorTripPickerLabel(
  title: string | null | undefined,
  startDate: string | null | undefined,
) {
  const name = (title ?? "").trim();
  const date = editorTripPickerDate(startDate);
  if (name && date) {
    return `${name} | ${date}`;
  }
  return name || date;
}
