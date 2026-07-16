import type { MetadataRoute } from "next";
import { readCoffeeContent } from "@/lib/coffee-store";
import { readContent } from "@/lib/editable-store";

const siteUrl = "https://travelos2-63r3.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ content: travelContent }, { content: coffeeContent }] = await Promise.all([readContent(), readCoffeeContent()]);
  const publicTrips = travelContent.trips.filter((trip) => trip.visibility !== "private");

  return [
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 1,
      url: siteUrl,
    },
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 0.9,
      url: `${siteUrl}/trips`,
    },
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 0.9,
      url: `${siteUrl}/coffee`,
    },
    ...publicTrips.map((trip) => ({
      changeFrequency: "monthly" as const,
      lastModified: new Date(trip.updatedAt),
      priority: 0.8,
      url: `${siteUrl}/trips/${trip.slug}`,
    })),
    ...coffeeContent.shops.map((shop) => ({
      changeFrequency: "monthly" as const,
      lastModified: new Date(shop.updatedAt),
      priority: 0.7,
      url: `${siteUrl}/coffee/${shop.slug}`,
    })),
  ];
}
