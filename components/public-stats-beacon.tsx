"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isPublicStorefront, PUBLIC_ORIGIN, UUID_PATTERN, VISITOR_COOKIE } from "@/lib/public-stats";

/** Invisible, public-layout-only effect; never waits on warehouse I/O. */
export function PublicStatsBeacon() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || !isPublicStorefront(pathname)) {
      previous.current = null;
      return;
    }
    if (location.origin !== PUBLIC_ORIGIN || navigator.webdriver) return;
    const send = () => {
      if (document.visibilityState !== "visible" || previous.current === pathname) return;
      try {
        let visitor = document.cookie.split("; ").find(v => v.startsWith(`${VISITOR_COOKIE}=`))?.split("=")[1];
        if (!visitor || !UUID_PATTERN.test(visitor)) {
          visitor = crypto.randomUUID();
          document.cookie = `${VISITOR_COOKIE}=${visitor}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
        }
        if (!document.cookie.includes(`${VISITOR_COOKIE}=${visitor}`)) return;
        previous.current = pathname;
        const body = JSON.stringify({ path: pathname, event: crypto.randomUUID() });
        if (!navigator.sendBeacon?.("/api/stats", new Blob([body], { type: "application/json" }))) {
          void fetch("/api/stats", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
        }
      } catch { /* Storage/network restrictions must never affect the storefront. */ }
    };
    const timer = window.setTimeout(send, 0);
    document.addEventListener("visibilitychange", send);
    return () => { clearTimeout(timer); document.removeEventListener("visibilitychange", send); };
  }, [pathname]);
  return null;
}
