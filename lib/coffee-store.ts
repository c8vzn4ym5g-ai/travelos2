import { list, put } from "@vercel/blob";
import { seedCoffeeShops } from "@/lib/coffee";
import { isAdminPinValid } from "@/lib/editable-store";
import type { CoffeePhoto, CoffeeShop } from "@/lib/types";

const COFFEE_BLOB_PATH = "travelos/coffee.json";
const COFFEE_SCHEMA_VERSION = 1;

export type CoffeeContent = {
  shops: CoffeeShop[];
  updatedAt: string;
  schemaVersion?: number;
};

export type CoffeeStoreStatus = {
  configured: boolean;
  source: "blob" | "seed";
};

export { isAdminPinValid };

export function isCoffeeBlobConfigured() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

export async function readCoffeeContent(): Promise<{ content: CoffeeContent; status: CoffeeStoreStatus }> {
  if (!isCoffeeBlobConfigured()) {
    return {
      content: createSeedCoffeeContent(),
      status: { configured: false, source: "seed" },
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
  const content: CoffeeContent = {
    schemaVersion: COFFEE_SCHEMA_VERSION,
    shops,
    updatedAt: new Date().toISOString(),
  };

  await put(COFFEE_BLOB_PATH, JSON.stringify(content, null, 2), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
  });

  return content;
}

export async function addPhotoToCoffeeShop(coffeeShopId: string, photo: CoffeePhoto) {
  const { content } = await readCoffeeContent();
  const shops = content.shops.map((shop) =>
    shop.id === coffeeShopId
      ? {
          ...shop,
          photos: [photo, ...shop.photos],
          updatedAt: new Date().toISOString(),
        }
      : shop,
  );

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
