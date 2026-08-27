import type { MetadataRoute } from "next";

const siteUrl = "https://travelos2-63r3.vercel.app";

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
