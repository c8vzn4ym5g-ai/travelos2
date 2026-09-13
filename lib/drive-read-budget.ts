export const DRIVE_TRIP_READ_TIMEOUT_MS = 8_000;

/** One deadline covers access, listing, media and body decoding; not each hop. */
export async function withDriveReadBudget<T>(
  request: typeof fetch | undefined,
  operation: (read: typeof fetch) => Promise<T>,
  timeoutMs = DRIVE_TRIP_READ_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("讀取遊記逾時，請再試一次。");
      reject(error);
      controller.abort(error);
    }, timeoutMs);
  });
  const read: typeof fetch = (input, init) => {
    controller.signal.throwIfAborted();
    return (request ?? fetch)(input, {
      ...init,
      signal: init?.signal ? AbortSignal.any([controller.signal, init.signal]) : controller.signal,
    });
  };
  try { return await Promise.race([operation(read), deadline]); }
  finally { clearTimeout(timer); }
}
