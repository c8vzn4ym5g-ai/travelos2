export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > 1024) return new Response(null, {status: 413});
  let input;
  try { input = JSON.parse(raw); } catch { return new Response(null, {status:400}); }
  if (!input || !/^[a-f0-9-]{36}$/.test(input.id ?? "")
    || !["editor","upload","family","story","coffee","library"].includes(input.area)
    || !["page-update","read-timeout","read-failed","render-failed"].includes(input.kind)) {
    return new Response(null, {status:400});
  }
  console.error("[travelos-page-failure]", JSON.stringify({
    id: input.id, area: input.area, kind: input.kind,
    digest: /^\d{1,20}$/.test(input.digest ?? "") ? input.digest : undefined,
    version: "review-20260914-recovery",
  }));
  return new Response(null, {status:204, headers:{"Cache-Control":"no-store"}});
}
