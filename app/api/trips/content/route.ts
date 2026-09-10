import { isAdminPinValid, readContent, writeContent } from "@/lib/editable-store";
import type { TripDetail } from "@/lib/types";
import { writeDriveTrip } from "@/lib/drive-trips";
import { isBlobConfigured } from "@/lib/editable-store";

export const runtime = "nodejs";

function tripError(error: unknown, fallback: string) {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

export async function GET(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  try {
    const { content, status } = await readContent();
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
    const { content } = await readContent();
    if (content.trips.some((trip) => trip.id === body.trip?.id || trip.slug === body.trip?.slug)) {
      return Response.json({ error: "A trip with this title/address already exists" }, { status: 409 });
    }

    if (!isBlobConfigured()) {
      const savedTrip = await writeDriveTrip(body.trip);
      return Response.json({
        content: { ...content, trips: [savedTrip, ...content.trips], updatedAt: savedTrip.updatedAt },
        trip: savedTrip,
      });
    }
    const savedContent = await writeContent([body.trip, ...content.trips]);
    return Response.json({ content: savedContent, trip: body.trip });
  } catch (error) {
    return Response.json({ error: tripError(error, "尚未儲存，請再試一次。") }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as { trip?: TripDetail };
  if (!body.trip || !body.trip.id || !body.trip.slug || !body.trip.title) {
    return Response.json({ error: "Trip payload is required" }, { status: 400 });
  }

  try {
    const { content } = await readContent();
    if (!content.trips.some((trip) => trip.id === body.trip?.id)) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }

    if (content.trips.some((trip) => trip.id !== body.trip?.id && trip.slug === body.trip?.slug)) {
      return Response.json({ error: "Another trip already uses this slug" }, { status: 409 });
    }

    const updatedTrip = {
      ...body.trip,
      updatedAt: new Date().toISOString(),
    };
    if (!isBlobConfigured()) {
      const savedTrip = await writeDriveTrip(updatedTrip);
      const trips = content.trips.map((trip) => (trip.id === savedTrip.id ? savedTrip : trip));
      return Response.json({
        content: { ...content, trips, updatedAt: savedTrip.updatedAt },
        trip: savedTrip,
      });
    }

    const trips = content.trips.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip));
    const savedContent = await writeContent(trips);
    return Response.json({ content: savedContent, trip: updatedTrip });
  } catch (error) {
    return Response.json({ error: tripError(error, "尚未儲存，請再試一次。") }, { status: 500 });
  }
}
