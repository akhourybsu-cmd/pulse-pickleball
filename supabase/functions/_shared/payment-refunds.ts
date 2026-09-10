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
  await reconcileRefundPayment(r, account, intent, charge.id);
}
export async function reconcileRefundPayment(r: Runtime, account: string, intent: string, chargeId?: string) {
  const version = checked(await r.store.rpc('payment_begin_refund_sync', { p_account: account, p_live: r.livemode, p_intent: intent }));
  if (version == null) return;
  if (!chargeId) {
    const payment = await r.stripe.paymentIntents.retrieve(intent, {}, options(r, account));
    chargeId = typeof payment.latest_charge === 'string' ? payment.latest_charge : payment.latest_charge?.id;
    if (!chargeId) throw new Error('Refund details are not available yet.');
  }
  // Ignore webhook/earlier request snapshots. Read again AFTER claiming a version.
  const current = await r.stripe.charges.retrieve(chargeId, {}, options(r, account));
  if (current.payment_intent !== intent || current.currency !== 'usd' || current.livemode !== r.livemode) throw new Error('Refund merchant/payment mismatch.');
  const attempts = [];
  for await (const refund of r.stripe.refunds.list({ charge: current.id, limit: 100 }, options(r, account))) {
    if (refund.charge !== current.id || refund.currency !== current.currency) throw new Error('Refund charge mismatch.');
    attempts.push({ id: refund.id, amount: refund.amount, status: refund.status });
  }
  const applied = checked(await r.store.rpc('payment_apply_refund_snapshot', { p_account: account, p_live: r.livemode, p_intent: intent, p_version: version, p_amount: current.amount, p_attempts: attempts, p_disputed: current.disputed === true }));
  if (!applied) throw new Error('A newer refund check is in progress. Please refresh.');
}
