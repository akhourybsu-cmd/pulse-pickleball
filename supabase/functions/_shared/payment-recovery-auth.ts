/** Only scheduler secrets authorize recovery; player sessions never do. */
export async function authorizePaymentRecovery(
  request: Request,
  secret: string | undefined,
  validateScheduler: (secret: string) => Promise<boolean>
): Promise<boolean> {
  if (request.method !== "POST") return false;
  if (
    secret &&
    secret.length >= 32 &&
    request.headers.get("x-payment-reconcile-secret") === secret
  )
    return true;
  const scheduler = request.headers.get("x-dispatch-secret");
  if (!scheduler || scheduler.length < 32 || scheduler.length > 512)
    return false;
  try {
    return (await validateScheduler(scheduler)) === true;
  } catch {
    return false;
  }
}
