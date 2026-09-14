"use client";

import { tripDisplayDate } from "@/lib/trip-display-date";
import type { Trip } from "@/lib/types";

type DateSettings = Pick<Trip, "publicDateLabel" | "showEntryDates">;

export function EditorDateLabel({ startDate, publicDateLabel, showEntryDates, onChange }: DateSettings & {
  startDate: string;
  onChange: (settings: DateSettings) => void;
}) {
  const label = tripDisplayDate({ startDate, publicDateLabel });
  return <div className="vj-fields">
    <label>公開日期文字
      <input value={label} placeholder="例如：2020 冬天；留白不顯示" onChange={event => onChange({ publicDateLabel: event.target.value, showEntryDates })} />
    </label>
    <div className="vj-date-actions">
      <button type="button" onClick={() => onChange({ publicDateLabel: "", showEntryDates })}>不顯示日期</button>
      <button type="button" onClick={() => onChange({ publicDateLabel: undefined, showEntryDates })}>使用年月</button>
    </div>
    <label style={{ display: "flex", alignItems: "center", gap: ".6rem" }}>
      <input type="checkbox" style={{ width: "auto" }} checked={showEntryDates === true} onChange={event => onChange({ publicDateLabel, showEntryDates: event.target.checked })} />
      顯示每段故事的日期
    </label>
    <p>只調整閱讀版面；原始旅行與照片日期保留。</p>
  </div>;
}
