import { getDriveAccess } from "@/lib/drive-warehouse";
import { isAdminPinValid } from "@/lib/family-pin";
import { tripMediaContentType } from "@/lib/trip-photo";

export const runtime = "nodejs";

function isGenericContentType(value: string | null) {
  const type = (value ?? "").split(";")[0].trim().toLowerCase();
  return !type || type === "application/octet-stream" || type === "binary/octet-stream";
}

async function resolveMediaContentType(input: {
  authToken: string;
  driveContentType: string | null;
  filename: string;
  id: string;
}) {
  let filename = input.filename;
  let mimeType = "";
  if (isGenericContentType(input.driveContentType) && !filename) {
    const meta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${input.id}?fields=name,mimeType`,
      { headers: { Authorization: `Bearer ${input.authToken}` } },
    );
    if (meta.ok) {
      const record = (await meta.json()) as { mimeType?: unknown; name?: unknown };
      filename = typeof record.name === "string" ? record.name : "";
      mimeType = typeof record.mimeType === "string" ? record.mimeType : "";
    }
  }

  return tripMediaContentType({
    driveContentType: input.driveContentType,
    filename,
    mimeType,
  });
}

export async function GET(request: Request) {
  if (!isAdminPinValid(request.headers.get("x-travelos-admin-pin"))) return new Response(null, { status: 401 });
  const url = new URL(request.url);
  const access = await getDriveAccess();
  if (!access) return new Response(null, { status: 503 });
  const headers: Record<string, string> = { Authorization: `Bearer ${access.token}` };
  let id = url.searchParams.get("id");
  let filename = "";
  if (!id) {
    const name = url.searchParams.get("name") ?? "";
    if (!/^travelos__promo__[a-z0-9-]+\.mp4$/.test(name)) return new Response(null, { status: 400 });
    filename = name;
    const query = new URLSearchParams({ q: `'${access.folderId}' in parents and trashed = false and name = '${name}'`, fields: "files(id)" });
    const listing = await fetch(`https://www.googleapis.com/drive/v3/files?${query}`, { headers });
    if (!listing.ok) return new Response(null, { status: 502 });
    id = ((await listing.json()) as { files: Array<{ id: string }> }).files[0]?.id ?? null;
  }
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) return new Response(null, { status: 404 });
  const range = request.headers.get("range");
  if (range) headers.Range = range;
  const media = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers });
  const outputHeaders = new Headers({ "Cache-Control": "private, max-age=86400" });
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = media.headers.get(key);
    if (value) outputHeaders.set(key, value);
  }
  outputHeaders.set(
    "content-type",
    await resolveMediaContentType({
      authToken: access.token,
      driveContentType: media.headers.get("content-type"),
      filename,
      id,
    }),
  );
  if (!outputHeaders.has("accept-ranges")) outputHeaders.set("accept-ranges", "bytes");
  return new Response(media.body, { status: media.status, headers: outputHeaders });
}
