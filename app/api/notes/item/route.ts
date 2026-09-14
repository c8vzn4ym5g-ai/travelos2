import { isAdminPinValid } from "@/lib/family-pin";
import { noteCategory, NoteRequestError, readCategoryNote, saveCategoryNote } from "@/lib/category-notes";
import type { CoffeeShop } from "@/lib/types";

export const runtime = "nodejs";
function failure(error: unknown) {
  return Response.json({ error: error instanceof NoteRequestError ? error.message : "文章暫時無法讀取或儲存；你的修改仍保留，請再試一次。" }, { status: error instanceof NoteRequestError ? error.status : 503 });
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const item = await readCategoryNote(noteCategory(params.get("category")), { id: params.get("id") ?? undefined, slug: params.get("slug") ?? undefined }, params.get("mode") === "edit" ? "edit" : "public");
    if (!item) throw new NoteRequestError("找不到這篇文章。", 404);
    return Response.json({ item }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

async function save(request: Request, create: boolean) {
  if (!isAdminPinValid(request.headers.get("x-travelos-admin-pin"))) return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  try {
    const body = await request.json() as { category?: string; item?: CoffeeShop; baseUpdatedAt?: string; publish?: boolean };
    if (!body.item) throw new NoteRequestError("請提供文章內容。", 400);
    const item = await saveCategoryNote(noteCategory(body.category), body.item, { create, baseUpdatedAt: body.baseUpdatedAt, publish: body.publish === true });
    return Response.json({ item });
  } catch (error) { return failure(error); }
}
export function POST(request: Request) { return save(request, true); }
export function PUT(request: Request) { return save(request, false); }
