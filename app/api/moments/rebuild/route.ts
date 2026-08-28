import { isAdminPinValid, momentApiErrorResponse, readMoments, rebuildDriveMomentIndex } from "@/lib/moment-store";
import { countUniqueDisplayJpegs } from "@/lib/drive-photo-index";

export const runtime = "nodejs";
export const maxDuration = 60;

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function GET(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const { content, status } = await readMoments();
    return Response.json({
      content,
      displayJpegCount: countUniqueDisplayJpegs(content.moments),
      momentCount: content.moments.length,
      status,
    });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const rebuilt = await rebuildDriveMomentIndex();
    return Response.json({
      content: rebuilt.content,
      displayJpegCount: rebuilt.displayJpegCount,
      fileCount: rebuilt.fileCount,
      momentCount: rebuilt.momentCount,
      rebuilt: rebuilt.rebuilt,
    });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}
