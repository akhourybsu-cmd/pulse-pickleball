/** Stripe's argument parser does not recognize an empty trailing {} as request
 * options. Include the pinned API version for platform AND connected requests. */
export function stripeRequestOptions(platform: string, account: string, key?: string) {
  if (!/^acct_[A-Za-z0-9]+$/.test(account)) throw new Error('Invalid payment account.');
  return {
    apiVersion: '2025-08-27.basil' as const,
    ...(account === platform ? {} : { stripeAccount: account }),
    ...(key ? { idempotencyKey: key } : {}),
  };
}
