import {
  addJob,
  addMoment,
  isAdminPinValid,
  momentApiErrorResponse,
  readMoments,
  scheduleMissingMomentTranscripts,
  scheduleMomentIndex,
  updateJob,
  updateMoment,
} from "@/lib/moment-store";
import { createTravelJob, createTravelMoment, normalizeTravelJob, selectMomentIdsForCommand } from "@/lib/moments";
import type { GeoPoint, TravelJob, TravelMoment } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type CreateMomentBody = {
  command?: string | null;
  coordinates?: GeoPoint | null;
  draft?: string;
  id?: string;
  note?: string;
  time?: string | null;
  tripId?: string | null;
};

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function GET(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const { content, status } = await readMoments();
    scheduleMissingMomentTranscripts(content.moments);
    return Response.json({ content, status });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const body = (await request.json()) as CreateMomentBody;
    const moment = createTravelMoment({
      command: body.command,
      coordinates: body.coordinates ?? null,
      draft: body.draft,
      id: body.id,
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
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const body = (await request.json()) as { job?: TravelJob; moment?: Partial<TravelMoment> & { id: string } };
    if (body.job?.id) {
      const nextJob = normalizeTravelJob(body.job);
      const saved = await updateJob(nextJob);
      if (saved) {
        return Response.json({ content: saved.content, job: saved.job });
      }

      const created = await addJob(nextJob);
      if (created.conflict) {
        return Response.json({ error: "A job with this id already exists" }, { status: 409 });
      }

      return Response.json({ content: created.content, job: created.job });
    }

    if (!body.moment || !body.moment.id) {
      return Response.json({ error: "Moment payload is required" }, { status: 400 });
    }

    const saved = await updateMoment(body.moment);
    if (!saved) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
    }

    if (!saved.moment.command) {
      return Response.json({ content: saved.content, job: null, moment: saved.moment });
    }

    const existingJob = saved.content.jobs.find((job) => job.sourceMomentId === saved.moment.id);
    if (existingJob) {
      return Response.json({ content: saved.content, job: existingJob, moment: saved.moment });
    }

    const momentIds = selectMomentIdsForCommand(saved.moment.command, saved.content.moments, saved.moment.id);
    const job = createTravelJob({
      command: saved.moment.command,
      momentIds,
      sourceMomentId: saved.moment.id,
    });
    const withJob = await addJob(job);
    if (withJob.conflict) {
      return Response.json({ content: withJob.content, job: null, moment: saved.moment });
    }

    return Response.json({ content: withJob.content, job: withJob.job, moment: saved.moment });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}
