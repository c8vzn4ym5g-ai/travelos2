import {
  addJob,
  addMoment,
  isAdminPinValid,
  readMoments,
  scheduleMomentIndex,
  updateJob,
  updateMoment,
} from "@/lib/moment-store";
import { createTravelJob, createTravelMoment, normalizeTravelJob, normalizeTravelMoment, selectMomentIdsForCommand } from "@/lib/moments";
import type { GeoPoint, TravelJob, TravelMoment } from "@/lib/types";

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

  if (!moment.command) {
    scheduleMomentIndex(saved.moment.id);
    return Response.json({ content: saved.content, job: null, moment: saved.moment });
  }

  const momentIds = selectMomentIdsForCommand(moment.command, saved.content.moments, saved.moment.id);
  const job = createTravelJob({
    command: moment.command,
    momentIds,
    sourceMomentId: saved.moment.id,
  });
  const withJob = await addJob(job);
  if (withJob.conflict) {
    scheduleMomentIndex(saved.moment.id);
    return Response.json({ content: withJob.content, job: null, moment: saved.moment });
  }

  scheduleMomentIndex(saved.moment.id);
  return Response.json({ content: withJob.content, job: withJob.job, moment: saved.moment });
}

export async function PUT(request: Request) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as { job?: TravelJob; moment?: TravelMoment };
  if (body.job?.id) {
    const saved = await updateJob(normalizeTravelJob(body.job));
    if (!saved) {
      return Response.json({ error: "Job not found" }, { status: 404 });
    }

    return Response.json({ content: saved.content, job: saved.job });
  }

  if (!body.moment || !body.moment.id) {
    return Response.json({ error: "Moment payload is required" }, { status: 400 });
  }

  const saved = await updateMoment(normalizeTravelMoment(body.moment));
  if (!saved) {
    return Response.json({ error: "Moment not found" }, { status: 404 });
  }

  return Response.json({ content: saved.content, moment: saved.moment });
}
