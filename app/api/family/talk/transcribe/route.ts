import { handleTalkTranscribe } from "@/lib/family-talk";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  return handleTalkTranscribe(request);
}
