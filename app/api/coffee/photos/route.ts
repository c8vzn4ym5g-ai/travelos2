import { put } from "@vercel/blob";
import { addPhotoToCoffeeShop, isAdminPinValid } from "@/lib/coffee-store";
import type { CoffeePhoto } from "@/lib/types";

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
  const coffeeShopId = String(formData.get("coffeeShopId") ?? "");
  const caption = String(formData.get("caption") ?? "").trim();
  const takenAt = String(formData.get("takenAt") ?? "").trim();
  const file = formData.get("file");

  if (!coffeeShopId || !(file instanceof File)) {
    return Response.json({ error: "Coffee shop and photo file are required" }, { status: 400 });
  }

  const blob = await put(`travelos/coffee/photos/${coffeeShopId}/${Date.now()}-${cleanFilename(file.name)}`, file, {
    access: "public",
    addRandomSuffix: true,
  });

  const now = new Date().toISOString();
  const photo: CoffeePhoto = {
    id: `coffee_photo_${Date.now()}`,
    coffeeShopId,
    storageKey: blob.url,
    originalFilename: file.name,
    caption: caption || null,
    takenAt: takenAt ? new Date(takenAt).toISOString() : now,
    createdAt: now,
  };

  const content = await addPhotoToCoffeeShop(coffeeShopId, photo);
  return Response.json({ content, photo });
}
