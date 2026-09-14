import { describe, expect, it } from 'vitest';
import { stripeRequirementLabels, stripeSetupGuidance } from '@/lib/venues/stripeSetupGuidance';
import type { VenuePaymentSetup } from '@/lib/venues/paymentReadiness';

const data: VenuePaymentSetup = { mode: 'test', venue: { name: 'Palace', verification_approved_at: null }, courts: [], account: { account_id: 'acct_sample', charges_enabled: false, payouts_enabled: false } };
describe('Stripe owner guidance', () => {
  it('groups technical requirements into plain-language categories without person identifiers', () => {
    const labels = stripeRequirementLabels(['business_profile.url', 'business_profile.mcc', 'external_account', 'tos_acceptance.date', 'tos_acceptance.ip', 'person_privateid.first_name', 'person_privateid.last_name', 'unknown_internal_field']);
    expect(labels).toEqual(['Business website', 'Business category', 'Payout bank account', 'Stripe service agreement', 'Representative or owner details', 'Additional information requested by Stripe']);
    expect(labels.join(' ')).not.toContain('privateid');
  });
  it('prioritizes remaining submissions when other information is under review', () => {
    const result = stripeSetupGuidance({ ...data, account: { ...data.account!, requirements_due: ['external_account'], requirements_pending: ['individual.verification.document'] } }, false);
    expect(result.title).toBe('Stripe needs more information');
  });
  it('distinguishes pending review from unfinished onboarding', () => {
    for (const patch of [{ requirements_pending: ['individual.verification.document'] }, { disabled_reason: 'under_review' }, { disabled_reason: 'requirements.pending_verification' }]) {
      expect(stripeSetupGuidance({ ...data, account: { ...data.account!, ...patch } }, false).title).toBe('Stripe is reviewing your information');
    }
  });
  it('does not hide transfer or disconnect restrictions behind pending requirements', () => {
    const pending = { ...data, account: { ...data.account!, requirements_pending: ['individual.verification.document'] } };
    expect(stripeSetupGuidance({ ...pending, transferred: true }, false)).toMatchObject({ title: 'Financial ownership review required', showRequirements: false });
    expect(stripeSetupGuidance({ ...pending, account: { ...pending.account!, disconnected_at: 'today' } }, false)).toMatchObject({ title: 'Reconnect your Stripe account', showRequirements: false });
  });
  it('keeps unknown restrictions actionable and never claims collections are on', () => {
    expect(stripeSetupGuidance({ ...data, account: { ...data.account!, disabled_reason: 'rejected.other' } }, false).title).toBe('Stripe account needs attention');
    expect(stripeSetupGuidance(data, true).detail).toContain('explicitly enabled live-payment switch');
  });
});
