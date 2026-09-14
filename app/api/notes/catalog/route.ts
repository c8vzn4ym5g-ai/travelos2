import { noteCategory, NoteRequestError, readCategoryNotesCatalog } from "@/lib/category-notes";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const result = await readCategoryNotesCatalog(noteCategory(params.get("category")), {
      mode: params.get("mode") === "edit" ? "edit" : "public", q: params.get("q") ?? "",
      offset: Number(params.get("offset") ?? 0), limit: Number(params.get("limit") ?? 12),
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof NoteRequestError ? error.message : "文章目錄暫時無法讀取，請再試一次。" }, { status: error instanceof NoteRequestError ? error.status : 503 });
  }
}
