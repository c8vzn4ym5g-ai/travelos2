import type { ReactNode } from "react";

export function LaplandMoreCut({ children }: { children: ReactNode }) {
  return (
    <details className="lapland-more-cut max-w-4xl" data-lapland-more="">
      <summary className="travel-chip inline-flex min-h-11 cursor-pointer list-none items-center rounded-full px-4 py-2 text-sm font-semibold">
        更多 / More
      </summary>
      <div className="mt-6 grid gap-7">{children}</div>
    </details>
  );
}
