/** Bound read-only hydration, including requests stalled waiting for auth.
 * Never use this for mutations: a timed-out write may still have committed.
 */
export async function withReadDeadline<T>(
  read: (signal: AbortSignal) => Promise<T>,
  timeoutMs = 20_000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('The event refresh timed out. Please retry.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([read(controller.signal), deadline]);
  } finally {
    clearTimeout(timer!);
    controller.abort();
  }
}
