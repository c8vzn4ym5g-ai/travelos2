import { isAdminPinValid } from "@/lib/family-pin";
import { noteCategory, NoteRequestError, readCategoryNote } from "@/lib/category-notes";
import { putVideoBinary } from "@/lib/drive-warehouse";
import type { CoffeePhoto } from "@/lib/types";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!isAdminPinValid(request.headers.get("x-travelos-admin-pin"))) return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  try {
    const form = await request.formData();
    const category = noteCategory(form.get("category"));
    const id = String(form.get("itemId") ?? "");
    const file = form.get("file");
    if (!(file instanceof File)) throw new NoteRequestError("請選擇照片或影片。", 400);
    if (!await readCategoryNote(category, { id }, "edit")) throw new NoteRequestError("找不到這篇文章。", 404);
    const photoId = `note_photo_${crypto.randomUUID()}`;
    const stored = await putVideoBinary({ bytes: Buffer.from(await file.arrayBuffer()), mimeType: file.type || "image/jpeg", name: `travelos__${category}_photo__${photoId}` });
    const photo: CoffeePhoto = { id: photoId, coffeeShopId: id, storageKey: `/api/trips/media?id=${encodeURIComponent(stored.id)}`,
      originalFilename: file.name, mimeType: file.type || "image/jpeg", caption: null, takenAt: null, createdAt: new Date().toISOString() };
    return Response.json({ photo });
  } catch (error) {
    return Response.json({ error: error instanceof NoteRequestError ? error.message : "素材尚未加入；文章修改仍保留，請再試一次。" }, { status: error instanceof NoteRequestError ? error.status : 503 });
  }
}
