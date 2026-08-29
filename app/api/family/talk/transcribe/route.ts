import { isAdminPinValid } from "@/lib/family-pin";
import {
  getFamilyTalkAi,
  parseTalkLang,
  transcribeTalkAudio,
  TALK_MAX_AUDIO_BYTES,
  type FamilyTalkAi,
} from "@/lib/family-talk";

export const runtime = "nodejs";
export const maxDuration = 60;

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function handleTalkTranscribe(request: Request, ai?: FamilyTalkAi) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "沒聽到，再靠近一點、再點一次。" }, { status: 400 });
  }

  const lang = parseTalkLang(form.get("lang"));
  if (!lang) {
    return Response.json({ error: "只能聽中文或日文。" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof Blob) || file.size < 32) {
    return Response.json({ error: "沒聽到，再靠近一點、再點一次。" }, { status: 400 });
  }
  if (file.size > TALK_MAX_AUDIO_BYTES) {
    return Response.json({ error: "這句太長了，短一點再說一次。" }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const workerAi = ai ?? (await getFamilyTalkAi());
    const text = await transcribeTalkAudio(workerAi, bytes, lang);
    return Response.json({ text, lang });
  } catch (error) {
    const message = error instanceof Error ? error.message : "聽不懂這句，再靠近一點、再說一次。";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return handleTalkTranscribe(request);
}
