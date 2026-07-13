import { readContent, isAdminPinValid, writeContent } from "@/lib/editable-store";
import type { TripDetail } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const { content, status } = await readContent();
  return Response.json({ content, status });
}

export async function PUT(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as { trips?: TripDetail[] };
  if (!Array.isArray(body.trips)) {
    return Response.json({ error: "Trips payload is required" }, { status: 400 });
  }

  const content = await writeContent(body.trips);
  return Response.json({ content });
}
