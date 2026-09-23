/** Bound UI waits even when a request is waiting for the Auth client's lock.
 * Aborting fetch alone cannot interrupt that wait. No automatic write retry.
 */
export async function withAuthDeadline<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new DOMException('PULSE could not reconnect in time. Please retry.', 'TimeoutError'));
      controller.abort();
    }, timeoutMs);
  });
  try { return await Promise.race([operation(controller.signal), deadline]); }
  finally { clearTimeout(timer!); controller.abort(); }
}
