import { isAdminPinValid } from "@/lib/family-pin";
import {
  getFamilyTalkAi,
  isTalkLang,
  translateTalkText,
  type FamilyTalkAi,
} from "@/lib/family-talk";

export const runtime = "nodejs";
export const maxDuration = 60;

function pinFrom(request: Request) {
  return request.headers.get("x-travelos-admin-pin");
}

export async function handleTalkTranslate(request: Request, ai?: FamilyTalkAi) {
  if (!isAdminPinValid(pinFrom(request))) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  let body: { text?: unknown; from?: unknown; to?: unknown };
  try {
    body = (await request.json()) as { text?: unknown; from?: unknown; to?: unknown };
  } catch {
    return Response.json({ error: "沒有可以翻譯的句子。" }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim() : "";
  if (!text) {
    return Response.json({ error: "沒有可以翻譯的句子。" }, { status: 400 });
  }
  if (!isTalkLang(body.from) || !isTalkLang(body.to)) {
    return Response.json({ error: "只能中日互譯。" }, { status: 400 });
  }

  try {
    const workerAi = ai ?? (await getFamilyTalkAi());
    const translated = await translateTalkText(workerAi, text, body.from, body.to);
    return Response.json({ source: text, translated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "翻譯沒成功，再試一次。";
    return Response.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  return handleTalkTranslate(request);
}
