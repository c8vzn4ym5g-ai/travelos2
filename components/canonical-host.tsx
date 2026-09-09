"use client";

import { useEffect } from "react";
import { canonicalSiteUrl, isSpareVercelHost } from "@/lib/site-url";

export function CanonicalHost() {
  useEffect(() => {
    if (!isSpareVercelHost(window.location.host)) {
      return;
    }
    window.location.replace(canonicalSiteUrl(`${window.location.pathname}${window.location.search}${window.location.hash}`));
  }, []);
  return null;
}
