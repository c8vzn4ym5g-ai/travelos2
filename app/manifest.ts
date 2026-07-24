import type { MetadataRoute } from "next";

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
        src: "/travelos-icon.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/travelos-icon.png",
        type: "image/png",
      },
    ],
    id: "/",
    lang: "en",
    name: "TravelOS",
    orientation: "portrait",
    scope: "/",
    screenshots: [
      {
        form_factor: "wide",
        label: "TravelOS home",
        sizes: "512x512",
        src: "/travelos-icon.png",
        type: "image/png",
      },
    ],
    short_name: "TravelOS",
    shortcuts: [
      {
        description: "Browse, add, and edit our family travel memories",
        icons: [{ sizes: "512x512", src: "/travelos-icon.png", type: "image/png" }],
        name: "家庭編輯",
        short_name: "家庭",
        url: "/family",
      },
      {
        description: "Open travel journals",
        icons: [{ sizes: "512x512", src: "/travelos-icon.png", type: "image/png" }],
        name: "Trips",
        short_name: "Trips",
        url: "/trips",
      },
      {
        description: "Open coffee map",
        icons: [{ sizes: "512x512", src: "/travelos-icon.png", type: "image/png" }],
        name: "Coffee Map",
        short_name: "Coffee",
        url: "/coffee",
      },
    ],
    start_url: "/family",
    theme_color: "#0f766e",
  };
}
