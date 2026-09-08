import { describe, expect, it } from 'vitest';
import { LeagueFunctionError, requireLeagueFunctionData } from './functionResult';

describe('league edge-function responses', () => {
  const httpError = (body: unknown, status = 400) => ({
    data: null,
    error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
      context: Response.json(body, { status }),
    }),
  });
  it('surfaces the exact database rejection instead of the generic HTTP error', async () => {
    await expect(requireLeagueFunctionData(httpError({error:'Activate the league and season before starting or advancing its ladder'})))
      .rejects.toThrow('Activate the league and season');
  });
  it('prefers actionable messages over machine codes', async () => {
    await expect(requireLeagueFunctionData(httpError({error:'league_not_active',message:'Set the league to Active in Overview.'})))
      .rejects.toThrow('Set the league to Active');
  });
  it('preserves the tiebreak payload on HTTP 409', async () => {
    const body={error:'tiebreak_required',ties:[{group_index:0,player_ids:['a','b']}]};
    try { await requireLeagueFunctionData(httpError(body,409)); throw new Error('Expected rejection'); }
    catch(error) { expect(error).toBeInstanceOf(LeagueFunctionError); expect((error as LeagueFunctionError).data).toEqual(body); }
  });
  it('does not consume the original response body', async () => {
    const result=httpError({error:'Rejected'});
    await expect(requireLeagueFunctionData(result)).rejects.toThrow('Rejected');
    expect(await result.error.context.json()).toEqual({error:'Rejected'});
  });
  it('handles a non-JSON proxy response and network failures', async () => {
    await expect(requireLeagueFunctionData({data:null,error:new Error('Connection lost'),response:new Response('<html>Error</html>',{status:502})})).rejects.toThrow('Connection lost');
  });
  it('rejects application errors even on HTTP 200', async () => {
    await expect(requireLeagueFunctionData({data:{error:'Cannot generate'},error:null})).rejects.toThrow('Cannot generate');
  });
  it('returns success and idempotent results intact', async () => {
    const data={success:true,batch_id:'batch2',already_existed:true};
    expect(await requireLeagueFunctionData({data,error:null})).toEqual(data);
  });
  it('rejects empty or malformed success responses', async () => {
    for(const data of [null,'',[]]) await expect(requireLeagueFunctionData({data,error:null})).rejects.toThrow('no result');
  });
});
