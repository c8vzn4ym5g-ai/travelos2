import { isUploadBlob, uploadFilename } from "@/lib/form-upload";
import { filenameForAudioMime, isTrustedMomentAudioUrl, resolveAudioMime } from "@/lib/moment-audio";
import { readMomentBlobBytes } from "@/lib/moment-blob";
import {
  getMomentById,
  isAdminPinValid,
  momentApiErrorResponse,
  momentExists,
  scheduleMomentTranscript,
  setMomentAudio,
  storeMomentBinary,
} from "@/lib/moment-store";

export const runtime = "nodejs";
export const maxDuration = 60;

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function GET(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const momentId = new URL(request.url).searchParams.get("momentId")?.trim() ?? "";
    if (!momentId) {
      return Response.json({ error: "Moment is required" }, { status: 400 });
    }

    const moment = await getMomentById(momentId);
    const audioUrl = moment?.originalAudioUrl?.trim() ?? "";
    if (!audioUrl || !isTrustedMomentAudioUrl(audioUrl)) {
      return Response.json({ error: "找不到這段聲音。" }, { status: 404 });
    }

    const loaded = await readMomentBlobBytes(audioUrl);
    if (!loaded) {
      return Response.json({ error: "找不到這段聲音。" }, { status: 404 });
    }

    const bytes = loaded.bytes;
    const mime = resolveAudioMime(bytes, loaded.contentType) ?? "audio/mp4";
    return new Response(Buffer.from(bytes), {
      headers: {
        "Accept-Ranges": "none",
        "Cache-Control": "private, max-age=60",
        "Content-Disposition": `inline; filename="${filenameForAudioMime(mime)}"`,
        "Content-Type": mime,
        "X-Content-Type-Options": "nosniff",
      },
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

    const formData = await request.formData();
    const momentId = String(formData.get("momentId") ?? "");
    const file = formData.get("file");

    if (!momentId || !isUploadBlob(file)) {
      return Response.json({ error: "Moment and audio file are required" }, { status: 400 });
    }

    if (!(await momentExists(momentId))) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = resolveAudioMime(bytes, file.type) ?? file.type ?? "application/octet-stream";
    const audioName = uploadFilename(file, filenameForAudioMime(mime));
    const stored = new Blob([Buffer.from(bytes)], { type: mime });
    const blob = await storeMomentBinary(
      `travelos/moments/audio/${momentId}/${Date.now()}-${cleanFilename(audioName)}`,
      stored,
    );

    const spoken = String(formData.get("transcript") ?? "").trim();
    const saved = await setMomentAudio(momentId, blob.url, spoken ? { transcript: spoken } : undefined);
    if (!saved) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
    }

    scheduleMomentTranscript(momentId);
    return Response.json({ content: saved.content, moment: saved.moment });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (!isAdminPinValid(pinFrom(request))) {
      return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
    }

    const url = new URL(request.url);
    const momentId = url.searchParams.get("momentId") ?? "";
    if (!momentId) {
      return Response.json({ error: "Moment is required" }, { status: 400 });
    }

    const saved = await setMomentAudio(momentId, null);
    if (!saved) {
      return Response.json({ error: "Moment not found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (error) {
    return momentApiErrorResponse(error);
  }
}
