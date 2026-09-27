import { supabase } from '@/integrations/supabase/client';
import { withAuthDeadline } from '@/lib/authDeadline';

export interface MfaStatus {
  method: 'none' | 'email' | 'authenticator' | 'sms';
  verified: boolean;
  userId: string;
  sessionId: string;
  expiresAt?: string | null;
}
export const MFA_VERIFIED_EVENT = 'pulse:mfa-verified';

export async function getMfaStatus(): Promise<MfaStatus> {
  const { data, error, status: httpStatus } = await withAuthDeadline(signal => supabase.rpc('pulse_mfa_status').abortSignal(signal), 12_000);
  if (error) {
    const failure = new Error('Could not verify your sign-in security. Check your connection and retry.');
    // PostgREST returns transport failures as result objects rather than thrown
    // fetch errors. Keep that distinction from an actual server denial.
    if (httpStatus === 0 || httpStatus === 429 || httpStatus >= 500) {
      failure.name = 'AuthRetryableFetchError';
    }
    throw failure;
  }
  const status = data as unknown as MfaStatus & { error?: string };
  if (status?.error === 'sign_in_required') throw new Error('Your session has ended. Sign out and sign in again.');
  if (!status || typeof status.verified !== 'boolean' || !status.userId || !status.sessionId || !['none', 'email', 'authenticator', 'sms'].includes(status.method)) throw new Error('Sign-in verification is unavailable. Please retry.');
  return status;
}

export async function confirmMfaSession() {
  const status = await getMfaStatus();
  if (!status.verified) throw new Error('Complete verification before continuing.');
  window.dispatchEvent(new Event(MFA_VERIFIED_EVENT));
  return status;
}
