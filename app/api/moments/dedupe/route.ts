import { readContent } from "@/lib/editable-store";
import {
  applyUnreferencedDuplicatePhotoCleanup,
  isAdminPinValid,
  momentApiErrorResponse,
  readMoments,
} from "@/lib/moment-store";
import { journalLinkedPhotoIds } from "@/lib/photo-dedupe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const pin = request.headers.get("x-travelos-admin-pin");
    if (!isAdminPinValid(pin)) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const { content: tripsContent } = await readContent();
    const linked = journalLinkedPhotoIds(tripsContent.trips);
    const cleaned = await applyUnreferencedDuplicatePhotoCleanup(linked);
    const { status } = await readMoments({ hydrate: false });
    return Response.json({
      content: cleaned.content,
      dropped: cleaned.dropped,
      status,
    });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}
