import { isAdminPinValid } from "@/lib/family-pin";
import { readEditorTripCatalog } from "@/lib/editor-trip-catalog";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isAdminPinValid(request.headers.get("x-travelos-admin-pin"))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }
  try {
    return Response.json({ trips: await readEditorTripCatalog() }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "遊記目錄暫時無法讀取。" }, { status: 503 });
  }
}
