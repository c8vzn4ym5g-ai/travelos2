import { isFamilyPinRequired } from "@/lib/family-pin";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ required: isFamilyPinRequired() });
}
