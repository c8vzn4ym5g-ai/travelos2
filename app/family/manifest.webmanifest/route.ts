import manifest from "../manifest";

export function GET() {
  return Response.json(manifest(), {
    headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=300" },
  });
}
