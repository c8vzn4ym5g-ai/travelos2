import { readRequestOidcToken } from "@/lib/after-response";
import { filenameForAudioMime, resolveAudioMime } from "@/lib/moment-audio";
import { readMomentBlobBytes } from "@/lib/moment-blob";

export { momentNeedsTranscript } from "@/lib/moments";

export const MOMENT_TRANSCRIPT_TIMEOUT_MS = 20_000;
const GATEWAY_TRANSCRIBE_URL = "https://ai-gateway.vercel.sh/v4/ai/transcription-model";
const GATEWAY_OPENAI_TRANSCRIBE_URL = "https://ai-gateway.vercel.sh/v1/audio/transcriptions";
const OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions";
const GATEWAY_MODELS = ["openai/whisper-1", "openai/gpt-4o-mini-transcribe", "openai/gpt-4o-transcribe"];

type TranscriptAuth =
  | { mode: "gateway"; token: string }
  | { mode: "openai"; token: string };

export async function readTranscriptAuth(env: NodeJS.ProcessEnv = process.env): Promise<TranscriptAuth | null> {
  const gateway = env.AI_GATEWAY_API_KEY?.trim() || env.VERCEL_OIDC_TOKEN?.trim() || readRequestOidcToken();
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

  const auth = await readTranscriptAuth(env);
  if (!auth) {
    return null;
  }

  const mime = resolveAudioMime(bytes, declaredType) ?? "application/octet-stream";
  if (auth.mode === "gateway") {
    return transcribeViaGateway(bytes, mime, auth.token, request);
  }

  return transcribeViaOpenAI(bytes, mime, auth.token, request, OPENAI_TRANSCRIBE_URL, "whisper-1");
}

export async function transcribeAudioUrl(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
  request = fetch,
): Promise<string | null> {
  if (!(await readTranscriptAuth(env))) {
    return null;
  }

  try {
    const loaded = await readMomentBlobBytes(url);
    if (loaded?.bytes.byteLength) {
      return transcribeAudioBytes(loaded.bytes, loaded.contentType, env, request);
    }
  } catch {
    // Fall through to a direct fetch for non-blob URLs.
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

  const record = payload as { text?: unknown; transcript?: unknown };
  const text = record.text ?? record.transcript;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

async function transcribeViaGateway(
  bytes: Uint8Array,
  mime: string,
  token: string,
  request: typeof fetch,
) {
  for (const model of GATEWAY_MODELS) {
    const text = await transcribeViaGatewayModel(bytes, mime, token, request, model);
    if (text) {
      return text;
    }
  }

  return transcribeViaOpenAI(bytes, mime, token, request, GATEWAY_OPENAI_TRANSCRIBE_URL, "whisper-1");
}

async function transcribeViaGatewayModel(
  bytes: Uint8Array,
  mime: string,
  token: string,
  request: typeof fetch,
  model: string,
) {
  const response = await request(GATEWAY_TRANSCRIBE_URL, {
    body: JSON.stringify({
      audio: Buffer.from(bytes).toString("base64"),
      mediaType: mime,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "ai-model-id": model,
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
  url: string,
  model: string,
) {
  const form = new FormData();
  form.set("file", new Blob([Buffer.from(bytes)], { type: mime }), filenameForAudioMime(mime));
  form.set("model", model);

  const response = await request(url, {
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
