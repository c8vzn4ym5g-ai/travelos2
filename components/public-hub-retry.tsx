"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** A first-ever cold miss recovers as soon as the background snapshot is ready. */
export function PublicHubRetry() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 8000);
    return () => clearInterval(timer);
  }, [router]);
  return <p role="status" className="mt-3 text-sm">旅程載入中，稍後自動更新。 / Loading journeys; this page will update automatically.</p>;
}
