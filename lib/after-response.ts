const REQUEST_CONTEXT = Symbol.for("@vercel/request-context");

type WaitUntilContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export function afterResponse(work: () => Promise<unknown>) {
  const pending = Promise.resolve().then(work);
  const getContext = (
    globalThis as {
      [REQUEST_CONTEXT]?: { get?: () => WaitUntilContext };
    }
  )[REQUEST_CONTEXT]?.get;
  const waitUntil = getContext?.()?.waitUntil;
  if (typeof waitUntil === "function") {
    waitUntil(pending);
    return pending;
  }

  void pending;
  return pending;
}
