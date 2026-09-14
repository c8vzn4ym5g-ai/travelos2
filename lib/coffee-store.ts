import { list, put } from "@vercel/blob";
import { seedCoffeeShops } from "@/lib/coffee";
import { isAdminPinValid } from "@/lib/editable-store";
import type { CoffeePhoto, CoffeeShop } from "@/lib/types";
import { getDriveAccess, getWarehouseTripRecord, putItem } from "@/lib/drive-warehouse";
import { withDriveReadBudget } from "@/lib/drive-read-budget";

const COFFEE_BLOB_PATH = "travelos/coffee.json";
const COFFEE_WAREHOUSE_NAME = "travelos__coffee.json";
const COFFEE_SCHEMA_VERSION = 1;

export type CoffeeContent = {
  shops: CoffeeShop[];
  updatedAt: string;
  schemaVersion?: number;
};

export type CoffeeStoreStatus = {
  configured: boolean;
  source: "blob" | "drive" | "seed";
};

export { isAdminPinValid };

export function isCoffeeBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

async function readCoffeeFile(request?: typeof fetch): Promise<unknown> {
  try { return await getWarehouseTripRecord(COFFEE_WAREHOUSE_NAME, request); }
  catch (warehouseError) {
    return withDriveReadBudget(request, async read => {
      const access = await getDriveAccess(request);
      if (!access) throw warehouseError;
      const headers = { Authorization: `Bearer ${access.token}` };
      const query = new URLSearchParams({
        q: `'${access.folderId}' in parents and trashed = false and name = '${COFFEE_WAREHOUSE_NAME}'`,
        fields: "files(id,name)", pageSize: "1", orderBy: "modifiedTime desc",
      });
      const listing = await read(`https://www.googleapis.com/drive/v3/files?${query}`, { headers, cache: "no-store" });
      if (!listing.ok) throw warehouseError;
      const files = await listing.json() as { files?: Array<{ id: string; name: string }> };
      const selected = files.files?.find(file => file.name === COFFEE_WAREHOUSE_NAME);
      // A failed warehouse read is never downgraded to an empty/sample library.
      if (!selected) throw warehouseError;
      const response = await read(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(selected.id)}?alt=media`, { headers, cache: "no-store" });
      if (!response.ok) throw warehouseError;
      return response.json();
    }, 15_000);
  }
}

async function readWarehouseCoffee(request?: typeof fetch): Promise<CoffeeContent | null> {
  const raw = await readCoffeeFile(request);
  if (raw === null) return null;
  const record = raw as { moment?: unknown };
  const content = (record.moment ?? raw) as CoffeeContent;
  if (!Array.isArray(content.shops) || typeof content.updatedAt !== "string") {
    throw new Error("咖啡文章暫時無法讀取，請再試一次。");
  }
  return { shops: content.shops, updatedAt: content.updatedAt, schemaVersion: content.schemaVersion };
}

export async function readCoffeeContent(request?: typeof fetch): Promise<{ content: CoffeeContent; status: CoffeeStoreStatus }> {
  if (!isCoffeeBlobConfigured()) {
    const stored = await readWarehouseCoffee(request);
    return {
      content: stored ? mergeSeedCoffeeShops(stored) : createSeedCoffeeContent(),
      status: { configured: true, source: stored ? "drive" : "seed" },
    };
  }

  const blobs = await list({ prefix: COFFEE_BLOB_PATH, limit: 1 });
  const dataBlob = blobs.blobs.find((blob) => blob.pathname === COFFEE_BLOB_PATH);

  if (!dataBlob) {
    const content = createSeedCoffeeContent();
    await writeCoffeeContent(content.shops);
    return {
      content,
      status: { configured: true, source: "seed" },
    };
  }

  const response = await fetch(`${dataBlob.url}?v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) {
    return {
      content: createSeedCoffeeContent(),
      status: { configured: true, source: "seed" },
    };
  }

  const content = (await response.json()) as CoffeeContent;
  const mergedContent = mergeSeedCoffeeShops(content);
  const changed =
    content.schemaVersion !== COFFEE_SCHEMA_VERSION ||
    content.updatedAt !== mergedContent.updatedAt ||
    JSON.stringify(content.shops) !== JSON.stringify(mergedContent.shops);

  if (changed) {
    await writeCoffeeContent(mergedContent.shops);
  }

  return {
    content: changed ? mergedContent : { ...content, schemaVersion: content.schemaVersion ?? COFFEE_SCHEMA_VERSION },
    status: { configured: true, source: "blob" },
  };
}

export async function writeCoffeeContent(shops: CoffeeShop[]) {
  const content: CoffeeContent = mergeSeedCoffeeShops({
    schemaVersion: COFFEE_SCHEMA_VERSION,
    shops,
    updatedAt: new Date().toISOString(),
  });

  if (!isCoffeeBlobConfigured()) {
    await putItem(COFFEE_WAREHOUSE_NAME, JSON.stringify(content));
    const saved = await readWarehouseCoffee();
    if (!saved || JSON.stringify(saved.shops) !== JSON.stringify(content.shops) || saved.updatedAt !== content.updatedAt) {
      throw new Error("咖啡文章尚未確認儲存，請保留內容後再試一次。");
    }
    return saved;
  }

  await put(COFFEE_BLOB_PATH, JSON.stringify(content, null, 2), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });

  return content;
}

export async function addPhotoToCoffeeShop(coffeeShopId: string, photo: CoffeePhoto) {
  const { content } = await readCoffeeContent();
  let foundShop = false;
  const shops = content.shops.map((shop) =>
    shop.id === coffeeShopId
      ? (() => {
          foundShop = true;
          return {
            ...shop,
            photos: [photo, ...shop.photos],
            updatedAt: new Date().toISOString(),
          };
        })()
      : shop,
  );

  if (!foundShop) {
    return null;
  }

  return writeCoffeeContent(shops);
}

function createSeedCoffeeContent(): CoffeeContent {
  return {
    schemaVersion: COFFEE_SCHEMA_VERSION,
    shops: seedCoffeeShops,
    updatedAt: new Date().toISOString(),
  };
}

function mergeSeedCoffeeShops(content: CoffeeContent): CoffeeContent {
  const existingIds = new Set(content.shops.map((shop) => shop.id));
  const missingSeedShops = seedCoffeeShops.filter((shop) => !existingIds.has(shop.id));

  if (missingSeedShops.length === 0 && content.schemaVersion === COFFEE_SCHEMA_VERSION) {
    return content;
  }

  return {
    schemaVersion: COFFEE_SCHEMA_VERSION,
    shops: [...missingSeedShops, ...content.shops],
    updatedAt: new Date().toISOString(),
  };
}
