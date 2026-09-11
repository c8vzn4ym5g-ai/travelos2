import { acceptPublicView, readPublicStats } from "@/lib/public-stats-server";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

export async function GET() {
  try { return Response.json(await readPublicStats(), { headers }); }
  catch { return Response.json({ error: "訪客紀錄暫時讀不到，請稍後再試。" }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  try {
    await acceptPublicView(request);
    return new Response(null, { status: 204, headers });
  } catch { return Response.json({ error: "Stats storage unavailable" }, { status: 503, headers }); }
}
