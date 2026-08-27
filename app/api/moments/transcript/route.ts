import {
  isAdminPinValid,
  momentApiErrorResponse,
  runMomentTranscript,
} from "@/lib/moment-store";

export const runtime = "nodejs";
export const maxDuration = 60;

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

function requestedMomentIds(body: { momentId?: unknown; momentIds?: unknown }) {
  const ids: string[] = [];
  if (Array.isArray(body.momentIds)) {
    for (const value of body.momentIds) {
      if (typeof value === "string" && value.trim()) {
        ids.push(value.trim());
      }
    }
  }
  if (typeof body.momentId === "string" && body.momentId.trim()) {
    ids.push(body.momentId.trim());
  }
  return [...new Set(ids)].slice(0, 3);
}

export async function POST(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const body = (await request.json()) as { momentId?: unknown; momentIds?: unknown };
    const momentIds = requestedMomentIds(body);
    if (momentIds.length === 0) {
      return Response.json({ error: "Moment is required" }, { status: 400 });
    }

    const moments = [];
    for (const momentId of momentIds) {
      const moment = await runMomentTranscript(momentId);
      if (moment) {
        moments.push(moment);
      }
    }

    return Response.json({ moment: moments[0] ?? null, moments });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}
