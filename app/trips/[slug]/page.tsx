import { JournalReader } from "@/components/journal-reader";
import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { readPublicTripBySlug } from "@/lib/public-trip";
import { projectJournalForReader } from "@/lib/journal-entry-kind";
import { tripCover } from "@/lib/trip-cover";
import { isTripPublic } from "@/lib/trip-visibility";

export const dynamic = "force-dynamic";
interface TripDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ id?: string }>;
}
const loadPublicTrip = cache((slug: string, id?: string) => readPublicTripBySlug(slug, undefined, undefined, id));

export async function generateMetadata({ params, searchParams }: TripDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const trip = await loadPublicTrip(slug, (await searchParams)?.id);
  if (!trip || !isTripPublic(trip)) return {};
  const cover = tripCover(trip);
  const title = `${trip.title} - ${trip.city}, ${trip.country}`;
  const description = trip.summary;
  return {
    title, description,
    alternates: { canonical: `/trips/${trip.slug}` },
    openGraph: { title, description, type: "article", url: `/trips/${trip.slug}`,
      images: cover ? [{alt: cover.caption ?? trip.title, url: cover.storageKey}] : [] },
    twitter: { description },
  };
}

export default async function TripDetailPage({ params, searchParams }: TripDetailPageProps) {
  const { slug } = await params;
  const trip = await loadPublicTrip(slug, (await searchParams)?.id);
  if (!trip || !isTripPublic(trip)) notFound();
  return <JournalReader trip={projectJournalForReader(trip)} />;
}
