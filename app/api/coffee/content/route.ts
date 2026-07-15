import { isAdminPinValid, readCoffeeContent, writeCoffeeContent } from "@/lib/coffee-store";
import type { CoffeeShop } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const { content, status } = await readCoffeeContent();
  return Response.json({ content, status });
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

  const content = await writeCoffeeContent(body.shops);
  return Response.json({ content });
}
