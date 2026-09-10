import { describe, expect, it } from 'vitest';
import { emptyPaymentDraft, paymentDraftConflict, paymentDraftDirty, paymentDraftFrom, paymentDraftReducer as reduce, validatePaymentDraft, type VenuePaymentDraft } from '@/lib/venues/paymentDraft';

const value: VenuePaymentDraft = { prices: { court1: '25.00', court2: '0.00' }, policy: 'Cancel at least 24 hours before your reservation for a full refund.', email: 'support@palace.example', timezone: 'America/New_York', taxes: true, accepting: false };
const initial = () => reduce(emptyPaymentDraft, { type: 'receive', scope: 'venue:user1', value });

describe('payment draft preservation', () => {
  it('loads a draft without silently enabling payments', () => {
    const draft = paymentDraftFrom({ courts: [{ id: 'c1', hourly_rate: null }] });
    expect(draft).toMatchObject({ prices: { c1: '0.00' }, accepting: false, taxes: false });
    expect(paymentDraftDirty(initial())).toBe(false);
  });
  it('keeps unsaved rates and policy through a connection/background refresh', () => {
    const edited = reduce(initial(), { type: 'edit', patch: { policy: 'My unsaved policy', prices: { ...value.prices, court1: '30' } } });
    const refreshed = reduce(edited, { type: 'receive', scope: edited.scope, value: { ...value, prices: { court2: '0.00', court1: '25.00' } } });
    expect(refreshed.draft).toEqual(edited.draft);
    expect(paymentDraftDirty(refreshed)).toBe(true);
    expect(paymentDraftConflict(refreshed)).toBe(false);
  });
  it('detects changed saved settings without replacing the draft', () => {
    const edited = reduce(initial(), { type: 'edit', patch: { email: 'new@palace.example' } });
    const refreshed = reduce(edited, { type: 'receive', scope: edited.scope, value: { ...value, accepting: true } });
    expect(refreshed.draft?.email).toBe('new@palace.example');
    expect(paymentDraftConflict(refreshed)).toBe(true);
    const reset = reduce(refreshed, { type: 'reset' });
    expect(reset.draft?.accepting).toBe(true);
    expect(paymentDraftDirty(reset)).toBe(false);
  });
  it('accepts background updates when no local edits exist', () => {
    const refreshed = reduce(initial(), { type: 'receive', scope: 'venue:user1', value: { ...value, accepting: true } });
    expect(refreshed.draft?.accepting).toBe(true);
    expect(paymentDraftDirty(refreshed)).toBe(false);
  });
  it('clears the dirty state only on confirmed saving', () => {
    const edited = reduce(initial(), { type: 'edit', patch: { timezone: 'America/Chicago' } });
    expect(paymentDraftDirty(edited)).toBe(true);
    expect(paymentDraftDirty(reduce(edited, { type: 'saved', scope: edited.scope }))).toBe(false);
  });
  it('does not carry a draft or late save confirmation across venues/accounts', () => {
    const edited = reduce(initial(), { type: 'edit', patch: { accepting: true } });
    const changed = reduce(edited, { type: 'receive', scope: 'venue:user2', value });
    expect(changed.draft?.accepting).toBe(false);
    const editingAgain = reduce(changed, { type: 'edit', patch: { policy: 'new draft' } });
    expect(reduce(editingAgain, { type: 'saved', scope: 'venue:user1' })).toBe(editingAgain);
  });
});

describe('payment draft validation', () => {
  it('accepts valid settings and explicit free courts', () => expect(validatePaymentDraft(value)).toEqual({}));
  it.each(['', '-1', '1.999', '1e2', 'NaN', ' 25 ', '1000000', '.5', '01'])('rejects invalid rate %s without rounding or zero coercion', price => {
    expect(validatePaymentDraft({ ...value, prices: { c1: price } })['rate-c1']).toBeTruthy();
  });
  it('explains every missing requirement at once', () => {
    expect(Object.keys(validatePaymentDraft({ ...value, policy: 'Short', email: 'not-email', timezone: 'Invalid/Zone', taxes: false }))).toEqual(['policy', 'email', 'timezone', 'taxes']);
  });
  it('uses trimmed field lengths like the server', () => {
    expect(validatePaymentDraft({ ...value, policy: ' '.repeat(20), timezone: '' })).toHaveProperty('policy');
    expect(validatePaymentDraft({ ...value, policy: 'x'.repeat(2001) })).toHaveProperty('policy');
    expect(validatePaymentDraft({ ...value, email: ` ${value.email} `, timezone: ' UTC ' })).toEqual({});
  });
});
