"use client";

import { useEffect, useRef } from "react";
import { isPublicStorefront, PUBLIC_ORIGIN, UUID_PATTERN, VISITOR_COOKIE } from "@/lib/public-stats";

function readPathname() {
  if (typeof window === "undefined") return "";
  return window.location.pathname || "/";
}

/** Invisible public-layout beacon. Must never throw into the storefront. */
export function PublicStatsBeacon() {
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const send = (pathname: string) => {
      try {
        if (!pathname || !isPublicStorefront(pathname)) {
          previous.current = null;
          return;
        }
        if (window.location.origin !== PUBLIC_ORIGIN) return;
        if (typeof navigator !== "undefined" && navigator.webdriver) return;
        if (document.visibilityState !== "visible" || previous.current === pathname) return;

        let visitor = document.cookie
          .split("; ")
          .find((part) => part.startsWith(`${VISITOR_COOKIE}=`))
          ?.split("=")[1];
        if (!visitor || !UUID_PATTERN.test(visitor)) {
          visitor =
            typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
          // Only persist real UUID cookies; ephemeral ids still count this page once.
          if (UUID_PATTERN.test(visitor)) {
            document.cookie = `${VISITOR_COOKIE}=${visitor}; Path=/; Max-Age=31536000; SameSite=Lax; Secure`;
          }
        }
        previous.current = pathname;
        const eventId =
          typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        if (!UUID_PATTERN.test(eventId)) return;
        const body = JSON.stringify({ path: pathname, event: eventId });
        if (!navigator.sendBeacon?.("/api/stats", new Blob([body], { type: "application/json" }))) {
          void fetch("/api/stats", {
            method: "POST",
            body,
            headers: { "Content-Type": "application/json" },
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        /* never affect storefront */
      }
    };

    send(readPathname());
    const onVisible = () => send(readPathname());
    document.addEventListener("visibilitychange", onVisible);

    // App Router soft navigations
    const wrap = (type: "pushState" | "replaceState") => {
      const original = history[type];
      return function (this: History, ...args: Parameters<History["pushState"]>) {
        const result = original.apply(this, args);
        queueMicrotask(() => send(readPathname()));
        return result;
      };
    };
    history.pushState = wrap("pushState");
    history.replaceState = wrap("replaceState");
    window.addEventListener("popstate", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("popstate", onVisible);
    };
  }, []);

  return null;
}
