import type { MetadataRoute } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@/lib/site-url";

const origin = DEFAULT_PUBLIC_SITE_ORIGIN;

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f8f3ea",
    categories: ["travel", "lifestyle", "photo"],
    description: "A personal travel journal, coffee map, photo album, and memory system.",
    dir: "ltr",
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "512x512",
        src: `${origin}/travelos-icon.png`,
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: `${origin}/travelos-icon.png`,
        type: "image/png",
      },
    ],
    id: `${origin}/`,
    lang: "en",
    name: "TravelOS",
    scope: `${origin}/`,
    screenshots: [
      {
        form_factor: "wide",
        label: "TravelOS home",
        sizes: "512x512",
        src: `${origin}/travelos-icon.png`,
        type: "image/png",
      },
    ],
    short_name: "TravelOS",
    shortcuts: [
      {
        description: "Open Capture after the family session",
        icons: [{ sizes: "512x512", src: `${origin}/travelos-icon.png`, type: "image/png" }],
        name: "Capture",
        short_name: "Capture",
        url: `${origin}/family/capture`,
      },
      {
        description: "Browse, add, and edit our family travel memories",
        icons: [{ sizes: "512x512", src: `${origin}/travelos-icon.png`, type: "image/png" }],
        name: "家庭編輯",
        short_name: "家庭",
        url: `${origin}/family`,
      },
      {
        description: "Open travel journals",
        icons: [{ sizes: "512x512", src: `${origin}/travelos-icon.png`, type: "image/png" }],
        name: "Trips",
        short_name: "Trips",
        url: `${origin}/trips`,
      },
      {
        description: "Open coffee map",
        icons: [{ sizes: "512x512", src: `${origin}/travelos-icon.png`, type: "image/png" }],
        name: "Coffee Map",
        short_name: "Coffee",
        url: `${origin}/coffee`,
      },
    ],
    start_url: `${origin}/family`,
    theme_color: "#0f766e",
  };
}
