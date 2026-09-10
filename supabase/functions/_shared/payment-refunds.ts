import { checked, options, type Runtime } from './payment-runtime.ts';

/** Requested/pending refunds are not money returned to the player. */
export async function settledRefundAmount(r: Runtime, account: string, charge: { id: string; amount: number }) {
  let total = 0;
  for await (const refund of r.stripe.refunds.list({ charge: charge.id, limit: 100 }, options(r, account))) {
    if (refund.status === 'succeeded') total += refund.amount;
  }
  if (!Number.isSafeInteger(total) || total < 0 || total > charge.amount) throw new Error('Refund amounts require review.');
  return total;
}
export async function recordSettledCharge(r: Runtime, account: string, charge: any) {
  const intent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
  if (!intent) return;
  checked(await r.store.rpc('payment_record_charge', { p_account: account, p_live: r.livemode, p_intent: intent, p_refunded: await settledRefundAmount(r, account, charge), p_disputed: charge.disputed === true }));
}
