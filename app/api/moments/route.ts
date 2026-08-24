import { addMoment, isAdminPinValid, readMoments, updateMoment } from "@/lib/moment-store";
import { createTravelMoment, normalizeTravelMoment } from "@/lib/moments";
import type { GeoPoint, TravelMoment } from "@/lib/types";

export const runtime = "nodejs";

type CreateMomentBody = {
  command?: string | null;
  coordinates?: GeoPoint | null;
  draft?: string;
  note?: string;
  time?: string | null;
  tripId?: string | null;
};

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function GET(request: Request) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const { content, status } = await readMoments();
  return Response.json({ content, status });
}

export async function POST(request: Request) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as CreateMomentBody;
  const moment = createTravelMoment({
    command: body.command,
    coordinates: body.coordinates ?? null,
    draft: body.draft,
    note: body.note,
    time: body.time,
    tripId: body.tripId,
  });

  const saved = await addMoment(moment);
  if (saved.conflict) {
    return Response.json({ error: "A moment with this id already exists" }, { status: 409 });
  }

  return Response.json({ content: saved.content, moment: saved.moment });
}

export async function PUT(request: Request) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as { moment?: TravelMoment };
  if (!body.moment || !body.moment.id) {
    return Response.json({ error: "Moment payload is required" }, { status: 400 });
  }

  const saved = await updateMoment(normalizeTravelMoment(body.moment));
  if (!saved) {
    return Response.json({ error: "Moment not found" }, { status: 404 });
  }

  return Response.json({ content: saved.content, moment: saved.moment });
}
