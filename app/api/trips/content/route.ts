import { afterResponse } from "@/lib/after-response";
import { cachePublicHubTrips } from "@/lib/public-hub";
import { isAdminPinValid, readContent, writeContent } from "@/lib/editable-store";
import type { TripDetail } from "@/lib/types";
import { saveDriveTripWithCatalog } from "@/lib/drive-trips";
import { readEditorTripRecord } from "@/lib/editor-trip-read";
import { seedTripDetails } from "@/lib/trips";
import { isBlobConfigured } from "@/lib/editable-store";
import { prepareTripSave } from "@/lib/trip-publication";
import { readEditorTripCatalog } from "@/lib/editor-trip-catalog";

export const runtime = "nodejs";

function tripError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

async function addressConflict(trip: TripDetail, creating: boolean) {
  const catalog = await readEditorTripCatalog();
  const known = [...catalog, ...seedTripDetails];
  if (known.some(item => (creating && item.id === trip.id) || (item.id !== trip.id && item.slug === trip.slug))) {
    return "Another trip already uses this address";
  }
  // New templates reserve the UUID-derived address; legacy free-form addresses
  // cannot be proven unique when the deployed catalog omits their slugs.
  const generated = /^trip_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trip.id)
    && trip.slug === trip.id.replaceAll("_", "-");
  if (!generated && catalog.some(item => item.id !== trip.id && !item.slug)) {
    return "目錄尚未提供完整遊記網址；請保留原網址後儲存。";
  }
  return null;
}

export async function GET(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  try {
    const id = new URL(request.url).searchParams.get("id");
    if (id && !isBlobConfigured()) {
      const stored = await readEditorTripRecord(id);
      const trip = stored ?? seedTripDetails.find(item => item.id === id);
      if (!trip) return Response.json({ error: "Trip not found" }, { status: 404 });
      return Response.json({ trip }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const { content, status } = await readContent();
    if (id) {
      const trip = content.trips.find(item => item.id === id);
      return trip ? Response.json({ trip }, { headers: { "Cache-Control": "private, no-store" } })
        : Response.json({ error: "Trip not found" }, { status: 404 });
    }
    if (status.source !== "seed") afterResponse(() => cachePublicHubTrips(content.trips));
    return Response.json(
      { content, status },
      {
        headers: {
          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    return Response.json({ error: tripError(error, "無法讀取家庭遊記。") }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as { trip?: TripDetail };
  if (!body.trip || !body.trip.id || !body.trip.slug || !body.trip.title) {
    return Response.json({ error: "Trip draft payload is required" }, { status: 400 });
  }

  try {
    if (!isBlobConfigured()) {
      const conflict = await addressConflict(body.trip, true);
      if (conflict) return Response.json({ error: conflict }, { status: 409 });
      if (await readEditorTripRecord(body.trip.id)) return Response.json({ error: "A trip with this ID already exists" }, { status: 409 });
      const { trip, warning } = await saveDriveTripWithCatalog({ ...body.trip, visibility: "private", publishedSnapshot: undefined });
      return Response.json({ trip, ...(warning ? { warning } : {}) });
    }
    const { content } = await readContent();
    if (content.trips.some((trip) => trip.id === body.trip?.id || trip.slug === body.trip?.slug)) {
      return Response.json({ error: "A trip with this title/address already exists" }, { status: 409 });
    }

    const newDraft = { ...body.trip, visibility: "private" as const, publishedSnapshot: undefined };
    const savedContent = await writeContent([newDraft, ...content.trips]);
    return Response.json({ content: savedContent, trip: newDraft });
  } catch (error) {
    return Response.json({ error: tripError(error, "尚未儲存，請再試一次。") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as { trip?: TripDetail; baseUpdatedAt?: string; publish?: boolean };
  if (!body.trip || !body.trip.id || !body.trip.slug || !body.trip.title) {
    return Response.json({ error: "Trip payload is required" }, { status: 400 });
  }

  try {
    if (!isBlobConfigured()) {
      const current = await readEditorTripRecord(body.trip.id) ?? seedTripDetails.find(item => item.id === body.trip!.id);
      if (!current) return Response.json({ error: "Trip not found" }, { status: 404 });
      if (body.baseUpdatedAt && current.updatedAt !== body.baseUpdatedAt) {
        return Response.json({ error: "家人已更新這篇游記。你的修改仍保留，請先對照最新版本再儲存。" }, { status: 409 });
      }
      if (current.slug !== body.trip.slug) {
        const conflict = await addressConflict(body.trip, false);
        if (conflict) return Response.json({ error: conflict }, { status: 409 });
      }
      const draft = prepareTripSave(current, { ...body.trip, updatedAt: new Date().toISOString() }, body.publish === true);
      const { trip, warning } = await saveDriveTripWithCatalog(draft);
      return Response.json({ trip, ...(warning ? { warning } : {}) });
    }
    const { content } = await readContent();
    if (!content.trips.some((trip) => trip.id === body.trip?.id)) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }
    const current = content.trips.find(trip => trip.id === body.trip?.id);
    if (body.baseUpdatedAt && current?.updatedAt !== body.baseUpdatedAt) {
      return Response.json({ error: "家人已更新這篇游記。你的修改仍保留，請先對照最新版本再儲存。" }, { status: 409 });
    }

    if (content.trips.some((trip) => trip.id !== body.trip?.id && trip.slug === body.trip?.slug)) {
      return Response.json({ error: "Another trip already uses this slug" }, { status: 409 });
    }

    const updatedTrip = prepareTripSave(current!, { ...body.trip, updatedAt: new Date().toISOString() }, body.publish === true);

    const trips = content.trips.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip));
    const savedContent = await writeContent(trips);
    await cachePublicHubTrips(trips);
    return Response.json({ content: savedContent, trip: updatedTrip });
  } catch (error) {
    return Response.json({ error: tripError(error, "尚未儲存，請再試一次。") }, { status: 500 });
  }
}
