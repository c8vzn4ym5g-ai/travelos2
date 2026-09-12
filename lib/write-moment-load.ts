import type { TravelJob, TravelMoment } from "./types";

/** A deep link resolves its saved batch independently of the warehouse catalog. */
export async function loadWriteMoments(requestedId: string | null, headers: HeadersInit, request: typeof fetch = fetch): Promise<{ moments: TravelMoment[]; jobs: TravelJob[] }> {
  if (requestedId !== null && !requestedId.trim()) throw new Error("照片批次連結不完整，請回工作台重新選擇。");
  const response = await request(requestedId === null ? "/api/moments" : `/api/moments?id=${encodeURIComponent(requestedId)}`, { cache: "no-store", headers });
  if (!response.ok) throw new Error(requestedId !== null && response.status === 404
    ? "找不到指定的這批照片。請回工作台重新選擇。"
    : "暫時無法讀取照片，請重新整理再試。已保存的內容不會因此刪除。");
  if (requestedId !== null) {
    const data = await response.json() as { moment?: TravelMoment };
    if (data.moment?.id !== requestedId) throw new Error("照片批次回應不符，請回工作台重新選擇。");
    return { moments: [data.moment], jobs: [] };
  }
  const data = await response.json() as { content?: { moments?: TravelMoment[]; jobs?: TravelJob[] } };
  if (!Array.isArray(data.content?.moments)) throw new Error("照片清單尚未讀取完成，請重新整理再試。");
  return { moments: data.content.moments, jobs: data.content.jobs ?? [] };
}
