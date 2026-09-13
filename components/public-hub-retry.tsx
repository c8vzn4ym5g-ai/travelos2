"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/** Recover a cold miss briefly, then let the reader retry without an endless spinner. */
export function PublicHubRetry({ href = "/trips" }: { href?: string }) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const timers = [
      setTimeout(() => router.refresh(), 4000),
      setTimeout(() => router.refresh(), 12000),
      setTimeout(() => setPaused(true), 20000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [router]);
  return (
    <div className="space-y-4">
      <p role="status" className="mt-3 text-sm leading-7">
        {paused ? "目前未能載入旅程，請重新載入。" : "正在取得旅程目錄，稍後會再試一次。"}
      </p>
      <form action={href} method="get">
        <button type="submit" className="travel-primary inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 font-semibold">重新載入</button>
      </form>
    </div>
  );
}
