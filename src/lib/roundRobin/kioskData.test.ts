import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { fetchRoundRobinKioskSnapshot } from './kioskData';

function fixture({ missing = false, failNames = false, failSchedule = false } = {}) {
  const calls: string[] = [];
  const signal = new AbortController().signal;
  const event = { id:'event',name:'Test',current_round:2,num_rounds:3,status:'live' };
  const rows = [
    {id:'past',round_no:1,is_bye:false},
    {id:'now',round_no:2,is_bye:false,a1_guest_id:'guest',b1_player_id:'player'},
    {id:'bye',round_no:2,is_bye:true},
    {id:'next',round_no:3,is_bye:false},
    {id:'abandoned',round_no:3,is_bye:false,abandoned:true},
  ];
  const client = {
    from(table: string) {
      calls.push(table);
      const q = {
        select: () => q, eq: () => q, is: () => q, order: () => q, range: () => q,
        abortSignal: (s: AbortSignal) => { expect(s).toBe(signal); return q; },
        maybeSingle: async () => ({ data: missing ? null : event, error:null }),
        then: (resolve: (value: unknown) => void) => resolve({ data: failSchedule ? null : rows, error:failSchedule ? new Error('Schedule unavailable') : null }),
      };
      return q;
    },
    rpc(name: string) {
      calls.push(name);
      return { abortSignal: (s: AbortSignal) => {
        expect(s).toBe(signal);
        return Promise.resolve({ data: failNames ? null : [
          {participant_id:'guest',name:'Guest Name',is_guest:true},
          {participant_id:'player',name:'Player Name',is_guest:false},
        ], error:failNames ? new Error('Names unavailable') : null });
      } };
    },
  } as unknown as SupabaseClient<Database>;
  return { load: () => fetchRoundRobinKioskSnapshot(client,'event',signal), calls };
}

describe('kiosk snapshot', () => {
  it('derives current and next games from one canonical schedule, including guest names', async () => {
    const f=fixture(); const result=await f.load();
    expect(result?.current).toHaveLength(1);
    expect(result?.current[0]).toMatchObject({id:'now',a1_guest:{display_name:'Guest Name'},b1_profile:{full_name:'Player Name'}});
    expect(result?.next.map(row=>row.id)).toEqual(['next']);
    expect(f.calls).toEqual(['round_robin_events','round_robin_schedule','rr_kiosk_participant_names']);
  });
  it('clears the public display when the event is no longer visible', async () => {
    expect(await fixture({missing:true}).load()).toBeNull();
  });
  it.each([{failNames:true},{failSchedule:true}])('rejects incomplete snapshots rather than replacing good data: %s', async options => {
    await expect(fixture(options).load()).rejects.toThrow('unavailable');
  });
  it('retains the last snapshot after a refresh failure, and recovers on the next success', async () => {
    const queries=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const queryKey=['round-robin-kiosk','event'];
    try {
      const original=await queries.fetchQuery({queryKey,queryFn:fixture().load});
      await expect(queries.fetchQuery({queryKey,queryFn:fixture({failSchedule:true}).load})).rejects.toThrow();
      expect(queries.getQueryData(queryKey)).toEqual(original);
      expect(queries.getQueryState(queryKey)?.status).toBe('error');
      await queries.fetchQuery({queryKey,queryFn:fixture().load});
      expect(queries.getQueryState(queryKey)?.status).toBe('success');
    } finally { queries.clear(); }
  });
});
