export interface VenuePaymentDraft {
  prices: Record<string, string>;
  policy: string;
  email: string;
  timezone: string;
  taxes: boolean;
  accepting: boolean;
}

export function paymentDraftFrom(data: {
  courts: { id: string; hourly_rate: number | null }[];
  settings?: { cancellation_policy?: string; support_email?: string; timezone?: string; tax_inclusive_acknowledged?: boolean; accepting_payments?: boolean } | null;
}): VenuePaymentDraft {
  return {
    prices: Object.fromEntries(data.courts.map(court => [court.id, Number(court.hourly_rate ?? 0).toFixed(2)])),
    policy: data.settings?.cancellation_policy ?? '', email: data.settings?.support_email ?? '',
    timezone: data.settings?.timezone ?? '', taxes: data.settings?.tax_inclusive_acknowledged ?? false,
    accepting: data.settings?.accepting_payments ?? false,
  };
}

function sameDraft(a: VenuePaymentDraft | null, b: VenuePaymentDraft | null): boolean {
  if (!a || !b) return a === b;
  const stable = (draft: VenuePaymentDraft) => JSON.stringify({ ...draft, prices: Object.entries(draft.prices).sort(([a], [b]) => a.localeCompare(b)) });
  return stable(a) === stable(b);
}

export interface PaymentDraftState {
  scope: string;
  baseline: VenuePaymentDraft | null;
  latest: VenuePaymentDraft | null;
  draft: VenuePaymentDraft | null;
}
export const emptyPaymentDraft: PaymentDraftState = { scope: '', baseline: null, latest: null, draft: null };
export const paymentDraftDirty = (state: PaymentDraftState) => !sameDraft(state.baseline, state.draft);
export const paymentDraftConflict = (state: PaymentDraftState) => paymentDraftDirty(state) && !sameDraft(state.baseline, state.latest);

export function paymentDraftReducer(state: PaymentDraftState, action:
  | { type: 'receive'; scope: string; value: VenuePaymentDraft }
  | { type: 'edit'; patch: Partial<VenuePaymentDraft> }
  | { type: 'saved'; scope: string }
  | { type: 'reset' }): PaymentDraftState {
  if (action.type === 'receive') {
    if (state.scope !== action.scope || !paymentDraftDirty(state)) return { scope: action.scope, baseline: action.value, latest: action.value, draft: action.value };
    return { ...state, latest: action.value };
  }
  if (action.type === 'edit') return state.draft ? { ...state, draft: { ...state.draft, ...action.patch } } : state;
  if (action.type === 'saved') return state.scope === action.scope ? { ...state, baseline: state.draft, latest: state.draft } : state;
  return { ...state, baseline: state.latest, draft: state.latest };
}

/** Match the payment endpoint's rules; do not silently round or turn empty rates into $0. */
export function validatePaymentDraft(draft: VenuePaymentDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const [id, price] of Object.entries(draft.prices)) {
    if (!/^(?:0|[1-9]\d{0,5})(?:\.\d{1,2})?$/.test(price) || Math.round(Number(price) * 100) > 99999999) errors[`rate-${id}`] = 'Enter a valid USD rate with up to two decimal places. Use 0 for a free court.';
  }
  if (draft.policy.trim().length < 20 || draft.policy.trim().length > 2000) errors.policy = 'Describe your cancellation and refund policy in 20–2,000 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) || draft.email.trim().length > 254) errors.email = 'Enter a valid support email for your venue.';
  try {
    if (!draft.timezone.trim()) throw new Error();
    new Intl.DateTimeFormat('en-US', { timeZone: draft.timezone.trim() });
  } catch { errors.timezone = 'Enter a valid time zone, such as America/New_York.'; }
  if (!draft.taxes) errors.taxes = 'Confirm that your rates include applicable taxes before saving.';
  return errors;
}
