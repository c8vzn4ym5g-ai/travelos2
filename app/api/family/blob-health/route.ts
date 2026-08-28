import { isAdminPinValid } from "@/lib/family-pin";
import { inspectBlobStore } from "@/lib/moment-blob";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  if (!isAdminPinValid(request.headers.get("x-travelos-admin-pin"))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  return Response.json(await inspectBlobStore({ includePut: true }));
}
