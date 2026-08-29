"use client";

type SpokenLineProps = {
  onChange: (next: string) => void;
  onCommit?: (next: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  value: string;
};

export function SpokenLine({
  onChange,
  onCommit,
  placeholder = "點這行就能改",
  readOnly = false,
  value,
}: SpokenLineProps) {
  const rows = Math.min(6, Math.max(2, value.split("\n").length));

  return (
    <textarea
      aria-label="剛聽成的字，點一下就能改"
      className="family-spoken-line mt-3 min-h-11 w-full resize-none rounded-2xl border px-3 py-2 text-base leading-7 outline-none"
      onBlur={() => onCommit?.(value)}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={rows}
      value={value}
    />
  );
}
