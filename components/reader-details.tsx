"use client";

import { useState, type ReactNode } from "react";

/** Keep map/media children unmounted until the reader asks for reference material. */
export function ReaderDetails({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <section className="travel-panel min-w-0 overflow-hidden rounded-2xl p-4">
    <button aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-semibold" onClick={() => setOpen(value => !value)} type="button"><span>{title}</span><span aria-hidden="true">{open ? "−" : "＋"}</span></button>
    {open ? <div className="mt-4 min-w-0 space-y-5">{children}</div> : null}
  </section>;
}
