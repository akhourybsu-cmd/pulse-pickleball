import type { VenuePaymentSetup } from './paymentReadiness';

/** Present categories only, never Stripe person IDs or identity values. */
export function stripeRequirementLabels(requirements: string[] = []): string[] {
  return [...new Set(requirements.map(field => {
    if (field.startsWith('tos_acceptance.')) return 'Stripe service agreement';
    if (field === 'external_account') return 'Payout bank account';
    if (field === 'business_profile.url') return 'Business website';
    if (field === 'business_profile.mcc') return 'Business category';
    if (field.startsWith('business_profile.')) return 'Business profile';
    if (field === 'business_type') return 'Business type';
    if (field.includes('.verification.document')) return 'Identity or business documents';
    if (field.startsWith('company.')) return 'Company details';
    if (/^(individual|representative|person_[^.]+)\./.test(field)) return 'Representative or owner details';
    return 'Additional information requested by Stripe';
  }))];
}

/** Guidance does not change payment eligibility; the server remains authoritative. */
export function stripeSetupGuidance(data: VenuePaymentSetup, connected: boolean) {
  if (data.transferred) return { title: 'Financial ownership review required', detail: 'Ownership changed. PULSE must review financial access. The previous owner’s Stripe account will not be reassigned.', showRequirements: false };
  if (data.account?.disconnected_at) return { title: 'Reconnect your Stripe account', detail: 'This venue’s Stripe account is disconnected. Reconnect the same account to restore the connection.', showRequirements: false };
  if (data.account?.requirements_due?.length) return { title: 'Stripe needs more information', detail: 'Complete the remaining items in Stripe. Any information already under review is listed separately; it does not need to be submitted again unless Stripe asks.', showRequirements: true };
  if (data.account?.requirements_pending?.length || data.account?.disabled_reason === 'requirements.pending_verification' || data.account?.disabled_reason === 'under_review') return { title: 'Stripe is reviewing your information', detail: 'Your information is with Stripe for review. Use Check connection for an updated status. Review Stripe setup if Stripe asks you for anything else.', showRequirements: true };
  if (connected) return { title: 'Stripe connected', detail: 'This venue’s Stripe account is connected. Rental collections still require the saved setup checks and an explicitly enabled live-payment switch.', showRequirements: true };
  if (data.account?.disabled_reason) return { title: 'Stripe account needs attention', detail: 'Open Stripe setup to review the account restriction and the next steps provided by Stripe. New rental payments are not available while the account is restricted.', showRequirements: true };
  return { title: data.account ? 'Finish Stripe onboarding' : 'Connect this venue to Stripe', detail: 'Complete business verification and payout details in Stripe. PULSE never collects bank credentials.', showRequirements: true };
}
