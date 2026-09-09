"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LaplandMobileStorefront } from "@/components/lapland-mobile-storefront";
import { LAPLAND_MOBILE_MAX_WIDTH_PX } from "@/lib/lapland-mobile";
import type { Photo, TripDetail } from "@/lib/types";

export function LaplandStorefrontGate({
  children,
  coverPhoto,
  enabled,
  trip,
  uaPhone,
}: {
  children: ReactNode;
  coverPhoto: Photo | undefined;
  enabled: boolean;
  trip: TripDetail;
  uaPhone: boolean;
}) {
  const [narrow, setNarrow] = useState(false);
  const [hasViewport, setHasViewport] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(`(max-width: ${LAPLAND_MOBILE_MAX_WIDTH_PX}px)`);
    const apply = () => {
      setNarrow(media.matches);
      setHasViewport(true);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  if (!enabled) {
    return children;
  }

  const phone = uaPhone || (hasViewport && narrow);
  if (phone) {
    return <LaplandMobileStorefront coverPhoto={coverPhoto} trip={trip} />;
  }

  return children;
}
