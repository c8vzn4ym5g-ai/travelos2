import type { MetadataRoute } from "next";
import { DEFAULT_PUBLIC_SITE_ORIGIN } from "@/lib/site-url";

const origin = DEFAULT_PUBLIC_SITE_ORIGIN;

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#f8f3ea",
    categories: ["travel", "lifestyle", "photo"],
    description: "家庭編輯：上傳、確認進倉、生成架構、檢查缺漏。",
    dir: "ltr",
    display: "standalone",
    icons: [
      { purpose: "any", sizes: "512x512", src: `${origin}/travelos-edit-icon.png`, type: "image/png" },
      { purpose: "maskable", sizes: "512x512", src: `${origin}/travelos-edit-icon.png`, type: "image/png" },
    ],
    id: `${origin}/family`,
    lang: "zh-Hant",
    name: "TravelOS 編輯版",
    scope: `${origin}/family`,
    short_name: "編輯版",
    start_url: `${origin}/family`,
    theme_color: "#c45c4a",
  };
}
