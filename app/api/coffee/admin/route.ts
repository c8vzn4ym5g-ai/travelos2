import { isAdminPinValid } from "@/lib/coffee-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");

  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  return Response.json({ ok: true });
}
