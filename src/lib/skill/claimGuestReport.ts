import type { GuestAssessment } from './guestAssessment';
import type { Responses, ScoringSnapshot } from './scoring';

export type ClaimFailure = 'sign_in' | 'account_changed' | 'conflict' | 'timeout' | 'retry';
export class GuestClaimError extends Error {
  constructor(public readonly reason: ClaimFailure) { super(reason); }
}

interface ClaimDependencies {
  getSession: () => Promise<{ data: { session: { access_token: string; user: { id: string } } | null }; error: unknown }>;
  invoke: (name: string, options: { body: { attemptId: string; assessmentVersion: number; responses: Responses }; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ data: unknown; error: unknown }>;
  isCurrent: () => boolean;
  timeoutMs?: number;
}

/** Pin a save to the session that requested it. Never remove browser answers here.
 * A timed-out request may have committed; retry with the same attempt ID.
 */
export async function claimGuestReport(draft: GuestAssessment, ownerId: string, deps: ClaimDependencies): Promise<ScoringSnapshot> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  const assertCurrent = () => {
    if (controller.signal.aborted) throw new GuestClaimError('timeout');
    if (!deps.isCurrent()) throw new GuestClaimError('account_changed');
  };
  const save = async () => {
    assertCurrent();
    const { data: { session }, error } = await deps.getSession();
    assertCurrent();
    if (error || !session) throw new GuestClaimError('sign_in');
    if (session.user.id !== ownerId) throw new GuestClaimError('account_changed');
    const result = await deps.invoke('skill-claim', {
      body: { attemptId: draft.id, assessmentVersion: 2, responses: draft.responses },
      headers: { Authorization: `Bearer ${session.access_token}` }, signal: controller.signal,
    });
    assertCurrent();
    if (result.error) {
      const status = (result.error as { context?: { status?: number } }).context?.status;
      throw new GuestClaimError(status === 401 ? 'sign_in' : status === 409 ? 'conflict' : 'retry');
    }
    const data = result.data as { authoritative?: boolean; attemptId?: string; snapshot?: ScoringSnapshot } | null;
    if (!data?.authoritative || data.attemptId !== draft.id || data.snapshot?.scoringModelVersion !== 2 ||
      !Number.isFinite(data.snapshot.estimatedLevelRaw) || !Array.isArray(data.snapshot.subskills)) throw new GuestClaimError('retry');
    return data.snapshot;
  };
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new GuestClaimError('timeout')); }, deps.timeoutMs ?? 25_000);
  });
  try { return await Promise.race([save(), deadline]); }
  finally { clearTimeout(timer!); }
}
