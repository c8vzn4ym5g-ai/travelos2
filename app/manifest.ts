import type { MetadataRoute } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@/lib/site-url";

const origin = DEFAULT_PUBLIC_SITE_ORIGIN;

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f8f3ea",
    categories: ["travel", "lifestyle"],
    description: "給讀者看的旅途與日常。",
    dir: "ltr",
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "512x512", src: `${origin}/travelos-icon.png`, type: "image/png" },
      { purpose: "maskable", sizes: "512x512", src: `${origin}/travelos-icon.png`, type: "image/png" },
    ],
    id: `${origin}/`,
    lang: "zh-Hant",
    name: "TravelOS",
    scope: `${origin}/`,
    short_name: "TravelOS",
    start_url: `${origin}/`,
    theme_color: "#0f766e",
  };
}
