import type { MetadataRoute } from "next";

const siteUrl = "https://travelos2-63r3.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        allow: ["/", "/trips", "/trips/", "/coffee", "/coffee/", "/drive"],
        disallow: ["/admin", "/trips/admin", "/trips/new", "/coffee/admin", "/coffee/new", "/api/"],
        userAgent: "*",
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
