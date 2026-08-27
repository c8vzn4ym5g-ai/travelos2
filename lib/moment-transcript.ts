import { filenameForAudioMime, resolveAudioMime } from "@/lib/moment-audio";

export { momentNeedsTranscript } from "@/lib/moments";

export const MOMENT_TRANSCRIPT_TIMEOUT_MS = 20_000;
const GATEWAY_TRANSCRIBE_URL = "https://ai-gateway.vercel.sh/v4/ai/transcription-model";
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";

type TranscriptAuth =
  | { mode: "gateway"; token: string }
  | { mode: "openai"; token: string };

export function readTranscriptAuth(env: NodeJS.ProcessEnv = process.env): TranscriptAuth | null {
  const gateway = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim();
  if (gateway) {
    return { mode: "gateway", token: gateway };
  }

  const openai = env.OPENAI_API_KEY?.trim();
  if (openai) {
    return { mode: "openai", token: openai };
  }

  return null;
}

export async function transcribeAudioBytes(
  bytes: Uint8Array,
  declaredType?: string | null,
  env: NodeJS.ProcessEnv = process.env,
  request = fetch,
): Promise<string | null> {
  if (bytes.byteLength < 12) {
    return null;
  }

  const auth = readTranscriptAuth(env);
  if (!auth) {
    return null;
  }

  const mime = resolveAudioMime(bytes, declaredType) ?? "application/octet-stream";
  if (auth.mode === "gateway") {
    return transcribeViaGateway(bytes, mime, auth.token, request);
  }

  return transcribeViaOpenAI(bytes, mime, auth.token, request);
}

export async function transcribeAudioUrl(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  request = fetch,
): Promise<string | null> {
  if (!readTranscriptAuth(env)) {
    return null;
  }

  const audioResponse = await request(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(MOMENT_TRANSCRIPT_TIMEOUT_MS),
  });
  if (!audioResponse.ok) {
    return null;
  }

  const bytes = new Uint8Array(await audioResponse.arrayBuffer());
  return transcribeAudioBytes(bytes, audioResponse.headers.get("content-type"), env, request);
}

function readTranscriptText(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const text = (payload as { text?: unknown }).text;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function transcribeViaGateway(
  bytes: Uint8Array,
  mime: string,
  token: string,
  request: typeof fetch,
) {
  const response = await request(GATEWAY_TRANSCRIBE_URL, {
    body: JSON.stringify({
      audio: Buffer.from(bytes).toString("base64"),
      mediaType: mime,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "ai-model-id": "openai/whisper-1",
    },
    method: "POST",
    signal: AbortSignal.timeout(MOMENT_TRANSCRIPT_TIMEOUT_MS),
  });
  if (!response.ok) {
    return null;
  }

  return readTranscriptText(await response.json());
}

async function transcribeViaOpenAI(
  bytes: Uint8Array,
  mime: string,
  token: string,
  request: typeof fetch,
) {
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(bytes)], { type: mime }), filenameForAudioMime(mime));
  form.set("model", "whisper-1");

  const response = await request(OPENAI_TRANSCRIBE_URL, {
    body: form,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: "POST",
    signal: AbortSignal.timeout(MOMENT_TRANSCRIPT_TIMEOUT_MS),
  });
  if (!response.ok) {
    return null;
  }

  return readTranscriptText(await response.json());
}
