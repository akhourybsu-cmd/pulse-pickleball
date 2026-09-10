import { describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { paymentStatus, refundNotice, cancellationLabel, canRequestCancellation, type PaymentOrder } from '@/lib/payments';
import { refreshPaymentWorkspace } from '@/lib/venues/paymentRefresh';

describe('refund recovery UX', () => {
  it('blocks duplicate cancellation forms but permits canceling after an external refund review completes', () => {
    const order = { kind: 'court_rental', status: 'paid', canceled_at: null } as PaymentOrder;
    expect(canRequestCancellation(order)).toBe(true);
    expect(canRequestCancellation({ ...order, payment_cancellation_requests: { status: 'requested', resolution_note: null } })).toBe(false);
    expect(canRequestCancellation({ ...order, status: 'refunded', payment_cancellation_requests: { status: 'approved', resolution_note: null, refund_review_only: true } })).toBe(true);
  });
  it('never labels a failed or pending refund as money returned, even on a canceled booking', () => {
    const order = { canceled_at: '2026-09-10', refunded_cents: 0, amount_cents: 1000, status: 'paid', refund_state: 'failed', livemode: true } as PaymentOrder;
    expect(paymentStatus(order)).toBe('Canceled · refund needs attention');
    expect(refundNotice(order)).toContain('has not been rebooked');
    expect(paymentStatus({ ...order, refund_state: 'pending' })).toBe('Canceled · refund processing');
    expect(refundNotice({ ...order, livemode: false })).toContain('no real reservation');
    expect(cancellationLabel('refund_failed')).toBe('Refund needs owner attention');
  });
  it('refreshes history, owner settings and owner requests together in the selected venue', async () => {
    const refetchQueries = vi.fn(async () => {});
    await refreshPaymentWorkspace({ refetchQueries } as any, 'venue-a', 'owner');
    expect(refetchQueries.mock.calls.map(c => (c as any)[0].queryKey)).toEqual([
      ['payment-history','venue-a'], ['venue-payment-requests','venue-a','owner'], ['venue-payments','venue-a','owner'],
    ]);
  });
  it('surfaces refresh failures rather than claiming the queue is current', async () => {
    await expect(refreshPaymentWorkspace({ refetchQueries: vi.fn(async () => { throw new Error('offline'); }) } as any, 'venue-a', 'owner')).rejects.toThrow('offline');
  });
});
