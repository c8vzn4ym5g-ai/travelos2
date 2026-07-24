import { isAdminPinValid, readContent, writeContent } from "@/lib/editable-store";
import type { TripDetail } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const { content, status } = await readContent();
  return Response.json({ content, status });
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

  const { content } = await readContent();
  if (content.trips.some((trip) => trip.id === body.trip?.id || trip.slug === body.trip?.slug)) {
    return Response.json({ error: "A trip with this title/address already exists" }, { status: 409 });
  }

  const savedContent = await writeContent([body.trip, ...content.trips]);
  return Response.json({ content: savedContent, trip: body.trip });
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
  const trips = content.trips.map((trip) => (trip.id === updatedTrip.id ? updatedTrip : trip));
  const savedContent = await writeContent(trips);

  return Response.json({ content: savedContent, trip: updatedTrip });
}
