import { isAdminPinValid, momentExists, setMomentAudio, storeMomentBinary } from "@/lib/moment-store";

export const runtime = "nodejs";

function cleanFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

export async function POST(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const formData = await request.formData();
  const momentId = String(formData.get("momentId") ?? "");
  const file = formData.get("file");

  if (!momentId || !(file instanceof File)) {
    return Response.json({ error: "Moment and audio file are required" }, { status: 400 });
  }

  if (!(await momentExists(momentId))) {
    return Response.json({ error: "Moment not found" }, { status: 404 });
  }

  const blob = await storeMomentBinary(
    `travelos/moments/audio/${momentId}/${Date.now()}-${cleanFilename(file.name || "moment-audio.webm")}`,
    file,
  );

  const saved = await setMomentAudio(momentId, blob.url);
  if (!saved) {
    return Response.json({ error: "Moment not found" }, { status: 404 });
  }

  return Response.json({ content: saved.content, moment: saved.moment });
}
