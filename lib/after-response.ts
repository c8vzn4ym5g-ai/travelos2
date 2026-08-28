type WaitUntilContext = {
  headers?: Record<string, string | undefined>;
  waitUntil?: (promise: Promise<unknown>) => void;
};

const REQUEST_CONTEXT_KEYS = [
  Symbol.for("@next/request-context"),
  Symbol.for("@vercel/request-context"),
] as const;
const CLOUDFLARE_CONTEXT_KEY = Symbol.for("__cloudflare-context__");

function readRequestContext(): WaitUntilContext | null {
  for (const key of REQUEST_CONTEXT_KEYS) {
    const getContext = (
      globalThis as {
        [contextKey: symbol]: { get?: () => WaitUntilContext } | undefined;
      }
    )[key]?.get;
    const context = getContext?.();
    if (context) {
      return context;
    }
  }

  return null;
}

function readCloudflareWaitUntil(): ((promise: Promise<unknown>) => void) | null {
  const context = (
    globalThis as Record<symbol, { ctx?: { waitUntil?: (promise: Promise<unknown>) => void } } | undefined>
  )[CLOUDFLARE_CONTEXT_KEY];
  const waitUntil = context?.ctx?.waitUntil;
  if (typeof waitUntil !== "function" || !context?.ctx) {
    return null;
  }
  return waitUntil.bind(context.ctx);
}

export function afterResponse(work: () => Promise<unknown>) {
  const pending = Promise.resolve().then(work);
  const waitUntil = readRequestContext()?.waitUntil ?? readCloudflareWaitUntil();
  if (typeof waitUntil === "function") {
    waitUntil(pending);
    return pending;
  }

  void pending;
  return pending;
}

export function readRequestOidcToken() {
  const headers = readRequestContext()?.headers;
  const fromHeader = headers?.["x-vercel-oidc-token"] ?? headers?.["X-Vercel-Oidc-Token"];
  return fromHeader?.trim() || null;
}
