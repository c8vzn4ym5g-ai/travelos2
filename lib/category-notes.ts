import { readCoffeeContent, writeCoffeeContent } from "@/lib/coffee-store";
import { getWarehouseTripRecord, putItem } from "@/lib/drive-warehouse";
import type { CoffeeShop } from "@/lib/types";

export type NoteCategory = "coffee" | "food";
export type NoteMode = "edit" | "public";
type NoteCollection = { shops: CoffeeShop[]; updatedAt: string; schemaVersion?: number };
const FOOD_FILE = "travelos__food.json";

export class NoteRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export function noteCategory(value: unknown): NoteCategory {
  if (value !== "coffee" && value !== "food") throw new NoteRequestError("請選擇咖啡或美食分類。", 400);
  return value;
}

async function readCollection(category: NoteCategory): Promise<NoteCollection> {
  if (category === "coffee") return (await readCoffeeContent()).content;
  const raw = await getWarehouseTripRecord(FOOD_FILE);
  if (raw === null) return { shops: [], updatedAt: "", schemaVersion: 1 };
  const record = raw as { moment?: unknown };
  const content = (record.moment ?? raw) as NoteCollection;
  if (!Array.isArray(content.shops) || typeof content.updatedAt !== "string") throw new Error("美食文章暫時無法讀取。");
  return content;
}

async function writeCollection(category: NoteCategory, shops: CoffeeShop[]) {
  if (category === "coffee") return writeCoffeeContent(shops);
  const content: NoteCollection = { shops, updatedAt: new Date().toISOString(), schemaVersion: 1 };
  await putItem(FOOD_FILE, JSON.stringify(content));
  const saved = await readCollection(category);
  if (JSON.stringify(saved.shops) !== JSON.stringify(shops) || saved.updatedAt !== content.updatedAt) throw new Error("美食文章尚未確認儲存，請保留內容後再試一次。");
  return saved;
}

function noteSnapshot(item: CoffeeShop): NonNullable<CoffeeShop["publishedSnapshot"]> {
  const { publishedSnapshot, ...snapshot } = item;
  void publishedSnapshot;
  return structuredClone(snapshot);
}

/** Legacy public samples stay public; unpublished drafts never become reader content. */
export function publishedCategoryNote(item: CoffeeShop): CoffeeShop | null {
  if (item.visibility === "private") return null;
  const published = item.publishedSnapshot ?? noteSnapshot(item);
  return { ...published, publishedSnapshot: undefined,
    journalEntries: published.journalEntries?.filter(entry => entry.entryKind !== "plan"),
  };
}

export async function readCategoryNote(category: NoteCategory, selector: { id?: string; slug?: string }, mode: NoteMode = "public") {
  if (!selector.id && !selector.slug) throw new NoteRequestError("請選擇文章。", 400);
  const { shops } = await readCollection(category);
  const items = mode === "edit" ? shops : shops.map(publishedCategoryNote).filter((item): item is CoffeeShop => item !== null);
  return items.find(item => selector.id ? item.id === selector.id : item.slug === selector.slug) ?? null;
}

export type NoteCatalogItem = {
  id: string; slug: string; title: string; summary: string; city: string; country: string;
  coverPhoto: { storageKey: string; caption: string | null } | null;
  updatedAt: string; visibility: "public" | "private";
};
const catalogCache = new Map<NoteCategory, { expires: number; edit: NoteCatalogItem[]; public: NoteCatalogItem[] }>();

function catalogItem(item: CoffeeShop): NoteCatalogItem {
  const photos=item.photos.filter(photo=>photo.storageKey.startsWith("/")||photo.storageKey.startsWith("http"));
  const cover = photos.find(photo => photo.id === item.coverPhotoId) ?? photos[0];
  return { id: item.id, slug: item.slug, title: item.name, summary: item.comments.slice(0, 240),
    city: item.city, country: item.country, updatedAt: item.updatedAt,
    visibility: item.visibility === "private" ? "private" : "public",
    coverPhoto: cover ? { storageKey: cover.storageKey, caption: cover.caption } : null,
  };
}

export async function readCategoryNotesCatalog(category: NoteCategory, options: { mode?: NoteMode; q?: string; offset?: number; limit?: number } = {}) {
  let cached = catalogCache.get(category);
  if (!cached || cached.expires <= Date.now()) {
    const { shops } = await readCollection(category);
    const byNewest = (a: NoteCatalogItem, b: NoteCatalogItem) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
    cached = { expires: Date.now() + 30_000,
      edit: shops.map(catalogItem).sort(byNewest),
      public: shops.map(publishedCategoryNote).filter((item): item is CoffeeShop => item !== null).map(catalogItem).sort(byNewest),
    };
    catalogCache.set(category, cached);
  }
  const mode = options.mode ?? "public";
  const query = (options.q ?? "").trim().toLocaleLowerCase().slice(0, 200);
  const offset = Math.max(0, Math.floor(options.offset || 0));
  const limit = Math.min(500, Math.max(1, Math.floor(options.limit || 12)));
  const items = cached[mode].filter(item => !query || [item.title, item.summary, item.city, item.country].some(value => value.toLocaleLowerCase().includes(query)));
  return { items: items.slice(offset, offset + limit), total: items.length, hasMore: offset + limit < items.length };
}

export async function saveCategoryNote(category: NoteCategory, input: CoffeeShop, options: { create?: boolean; baseUpdatedAt?: string; publish?: boolean } = {}) {
  if (!input?.id || !input.slug || !input.name?.trim()) throw new NoteRequestError("請填寫文章標題。", 400);
  const { shops } = await readCollection(category);
  const current = shops.find(item => item.id === input.id);
  if (options.create && current) throw new NoteRequestError("這篇文章已存在。", 409);
  if (!options.create && !current) throw new NoteRequestError("找不到這篇文章。", 404);
  if (current && (!options.baseUpdatedAt || current.updatedAt !== options.baseUpdatedAt)) throw new NoteRequestError("文章已有更新；你的修改仍保留，請先查看最新內容。", 409);
  if (shops.some(item => item.id !== input.id && item.slug === input.slug)) throw new NoteRequestError("另一篇文章已使用這個網址。", 409);
  const now = new Date().toISOString();
  let item: CoffeeShop;
  if (!current) {
    item = { ...input, visibility: "private", publishedSnapshot: undefined, createdAt: input.createdAt || now, updatedAt: now };
  } else {
    const draft = { ...current, ...input, updatedAt: now };
    const visibility = options.publish ? "public" : input.visibility === "private" ? "private" : current.visibility;
    item = { ...draft, visibility,
      publishedSnapshot: options.publish ? noteSnapshot({ ...draft, visibility: "public" })
        : current.publishedSnapshot ?? (current.visibility !== "private" ? noteSnapshot(current) : undefined),
    };
  }
  // Invalidate even after an uncertain write: the durable readback may have failed after saving.
  try {
    const saved = await writeCollection(category, current ? shops.map(value => value.id === item.id ? item : value) : [item, ...shops]);
    return saved.shops.find(value => value.id === item.id)!;
  } finally { catalogCache.delete(category); }
}

