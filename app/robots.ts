import type { MetadataRoute } from "next";
import { resolvePublicSiteOrigin } from "@/lib/site-url";

const siteUrl = resolvePublicSiteOrigin();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: ["/", "/trips", "/trips/", "/coffee", "/coffee/", "/drive"],
        disallow: ["/admin", "/family/capture", "/family/bench", "/trips/admin", "/trips/new", "/trips/write", "/coffee/admin", "/coffee/new", "/api/"],
        userAgent: "*",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
