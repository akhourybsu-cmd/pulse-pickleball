import { describe, expect, it } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { fetchRoundRobinKioskSnapshot } from './kioskData';

function fixture({ missing = false, failNames = false, failSchedule = false, sparse = false, scored = false, departed = false, status = 'live', voided = false } = {}) {
  const calls: string[] = [];
  const signal = new AbortController().signal;
  const event = { id:'event',name:'Test',current_round:2,num_rounds:3,status,voided };
  const rows = [
    {id:'past',round_no:1,is_bye:false},
    {id:'now',round_no:2,is_bye:false,a1_guest_id:'guest',b1_player_id:'player',team1_score:scored?11:null,team2_score:scored?0:null},
    {id:'bye',round_no:2,is_bye:true,a1_guest_id:'rest-1',a2_guest_id:'rest-2',b1_player_id:'rest-3',b2_player_id:'rest-4'},
    {id:'duplicate-bye',round_no:2,is_bye:true,a1_guest_id:'rest-1'},
    {id:'next',round_no:sparse?5:3,is_bye:false},
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
          {participant_id:'guest',name:'Guest Name',is_guest:true,active:true},
          {participant_id:'player',name:'Player Name',is_guest:false,active:!departed},
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
    expect(f.calls).toEqual(['round_robin_events','round_robin_schedule','rr_kiosk_participants']);
  });
  it('clears the public display when the event is no longer visible', async () => {
    expect(await fixture({missing:true}).load()).toBeNull();
  });
  it.each([{status:'draft'},{status:'voided'},{voided:true}])('clears unpublished or voided broadcasts: %s', async options => {
    expect(await fixture(options).load()).toBeNull();
  });
  it('does not invent a ranking before scores exist, including completed events', async () => {
    expect((await fixture().load())?.standings).toEqual([]);
    expect((await fixture({status:'completed'}).load())?.standings).toEqual([]);
  });
  it('ranks played active players with the shared scoring rules, preserving zero scores', async () => {
    const result = await fixture({scored:true}).load();
    expect(result?.standings.map(row => [row.name,row.wins,row.losses,row.gamesPlayed,row.pointDiff])).toEqual([
      ['Guest Name',1,0,1,11],['Player Name',0,1,1,-11],
    ]);
  });
  it('keeps departed players out of broadcast awards while noting their history', async () => {
    const result = await fixture({scored:true,departed:true}).load();
    expect(result?.standings.map(row=>row.key)).toEqual(['guest']);
    expect(result?.removedCount).toBe(1);
  });
  it('counts unique resting identities in all four seats', async () => {
    expect((await fixture().load())?.resting.map(row=>row.id)).toEqual(['rest-1','rest-2','rest-3','rest-4']);
  });
  it('finds the next saved round even when that round only contains resolved courts', async () => {
    const result = await fixture({sparse:true}).load();
    expect(result?.nextRound).toBe(3);
    expect(result?.next).toEqual([]);
    expect(result?.rounds).toEqual([1,2,3,5]);
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
