import { afterEach, describe, expect, it, vi } from 'vitest';
import { claimGuestReport } from '../../src/lib/skill/claimGuestReport';
import { createGuestAssessment } from '../../src/lib/skill/guestAssessment';
import { QUESTION_BANK_V2 } from '../../src/lib/skill/questionBankV2';
import { scoreAssessment } from '../../src/lib/skill/scoring';

const draft = createGuestAssessment();
const snapshot = scoreAssessment(QUESTION_BANK_V2, {});
const result = { data: { authoritative: true, attemptId: draft.id, snapshot }, error: null };
const session = { access_token: 'unit-test-token', user: { id: 'player-a' } };
type Invoke = Parameters<typeof claimGuestReport>[2]['invoke'];
function setup() { return { getSession: vi.fn(async () => ({ data: { session }, error: null })), invoke: vi.fn<Invoke>(async () => result), isCurrent: vi.fn(() => true), timeoutMs: 100 }; }
afterEach(() => vi.useRealTimers());

describe('guest report account handoff', () => {
  it('pins the request to the initiating account and sends raw answers with an explicit session token', async () => {
    const deps = setup();
    await expect(claimGuestReport(draft, 'player-a', deps)).resolves.toEqual(snapshot);
    expect(deps.invoke).toHaveBeenCalledWith('skill-claim', {
      body: { attemptId: draft.id, assessmentVersion: 2, responses: draft.responses },
      headers: { Authorization: 'Bearer unit-test-token' }, signal: expect.any(AbortSignal),
    });
  });
  it('requires sign-in when the session is absent or cannot be refreshed', async () => {
    const deps = setup();
    await expect(claimGuestReport(draft, 'player-a', { ...deps, getSession: async () => ({ data: { session: null }, error: null }) })).rejects.toMatchObject({ reason: 'sign_in' });
    await expect(claimGuestReport(draft, 'player-a', { ...deps, getSession: async () => ({ data: { session }, error: Error('expired') }) })).rejects.toMatchObject({ reason: 'sign_in' });
    expect(deps.invoke).not.toHaveBeenCalled();
  });
  it('never starts a save for a different account', async () => {
    const deps = setup();
    await expect(claimGuestReport(draft, 'player-b', deps)).rejects.toMatchObject({ reason: 'account_changed' });
    expect(deps.invoke).not.toHaveBeenCalled();
  });
  it('does not accept a late result after an account, draft or mounted page changes', async () => {
    const deps = setup();
    deps.isCurrent.mockReturnValueOnce(true).mockReturnValueOnce(true).mockReturnValue(false);
    await expect(claimGuestReport(draft, 'player-a', deps)).rejects.toMatchObject({ reason: 'account_changed' });
    expect(deps.invoke).toHaveBeenCalledOnce();
  });
  it.each([[401, 'sign_in'], [409, 'conflict'], [503, 'retry']] as const)('provides a recovery path for HTTP %s', async (status, reason) => {
    await expect(claimGuestReport(draft, 'player-a', { ...setup(), invoke: async () => ({ data: null, error: { context: { status } } }) })).rejects.toMatchObject({ reason });
  });
  it.each([
    null, { ...result.data, attemptId: 'another-attempt' }, { ...result.data, authoritative: false },
    { ...result.data, snapshot: { ...snapshot, estimatedLevelRaw: NaN } },
  ])('does not confirm an invalid response', async data => {
    await expect(claimGuestReport(draft, 'player-a', { ...setup(), invoke: async () => ({ data, error: null }) })).rejects.toMatchObject({ reason: 'retry' });
  });
  it('times out a stalled session refresh without posting later', async () => {
    vi.useFakeTimers();
    const deps = setup();
    let release!: (value: Awaited<ReturnType<typeof deps.getSession>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof deps.getSession>>>(resolve => { release = resolve; });
    const assertion = expect(claimGuestReport(draft, 'player-a', { ...deps, getSession: () => pending })).rejects.toMatchObject({ reason: 'timeout' });
    await vi.advanceTimersByTimeAsync(101); await assertion;
    release({ data: { session }, error: null });
    await vi.advanceTimersByTimeAsync(1);
    expect(deps.invoke).not.toHaveBeenCalled();
  });
  it('aborts a stalled save and reuses the same attempt ID on retry even if the first save committed', async () => {
    vi.useFakeTimers();
    const deps = setup();
    let release!: (value: typeof result) => void;
    deps.invoke.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const assertion = expect(claimGuestReport(draft, 'player-a', deps)).rejects.toMatchObject({ reason: 'timeout' });
    await vi.advanceTimersByTimeAsync(101); await assertion;
    const options = deps.invoke.mock.calls[0][1];
    expect(options.signal.aborted).toBe(true);
    release(result); await vi.advanceTimersByTimeAsync(1);
    await expect(claimGuestReport(draft, 'player-a', deps)).resolves.toEqual(snapshot);
    expect(deps.invoke.mock.calls.map(call => call[1].body.attemptId)).toEqual([draft.id, draft.id]);
  });
});
