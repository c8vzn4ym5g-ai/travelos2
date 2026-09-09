import { putVideoBinary } from "@/lib/drive-warehouse";
import { isAdminPinValid } from "@/lib/family-pin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isAdminPinValid(request.headers.get("x-travelos-admin-pin"))) return Response.json({ error: "無法存取" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "沒有收到錄音" }, { status: 400 });
  const saved = await putVideoBinary({ bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type || "audio/mp4", name: `travelos__voice__${Date.now()}` });
  return Response.json({ audioUrl: `/api/trips/media?id=${saved.id}` });
}
