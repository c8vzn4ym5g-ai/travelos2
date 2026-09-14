import { isAdminPinValid, readCoffeeContent, writeCoffeeContent } from "@/lib/coffee-store";
import type { CoffeeShop } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { content, status } = await readCoffeeContent();
    return Response.json({ content, status }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "咖啡文章暫時無法讀取，請再試一次。" }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  const pin = request.headers.get("x-travelos-admin-pin");
  if (!isAdminPinValid(pin)) {
    return Response.json({ error: "Invalid admin PIN" }, { status: 401 });
  }

  const body = (await request.json()) as { shops?: CoffeeShop[] };
  if (!Array.isArray(body.shops)) {
    return Response.json({ error: "Coffee shops payload is required" }, { status: 400 });
  }

  try {
    const { content: current } = await readCoffeeContent();
    const existing = new Map(current.shops.map(shop => [shop.id, shop]));
    const shops = body.shops.map(shop => ({
      ...shop,
      ...(!existing.has(shop.id) ? { visibility: shop.visibility ?? "private" as const }
        : existing.get(shop.id)?.visibility === "private" && !shop.visibility ? { visibility: "private" as const } : {}),
    }));
    const content = await writeCoffeeContent(shops);
    return Response.json({ content });
  } catch {
    return Response.json({ error: "咖啡文章尚未確認儲存，請保留內容後再試一次。" }, { status: 500 });
  }
}
