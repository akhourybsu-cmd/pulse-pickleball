import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { leaguePlayerName, matchSubstitutions, substitutePlayerIds, courtPlayerIds, substitutionTargets, matchPlayerLabel } from '@/lib/leagues/playerIdentity';
import { LeaguePlayerName, LeagueMatchSide } from '@/components/leagues/LeaguePlayerName';
import { StandingsTable } from '@/components/leagues/StandingsTable';
import { computePlayerStandings } from '@/lib/leagues/standings';
import type { LeagueMatch, LeagueMatchSubstitution } from '@/lib/leagues/types';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const game: LeagueMatch = { id:'game',player_a_id:'fill',player_b_id:'b',player_c_id:'c',player_d_id:'d',
  season_id:'season',status:'verified',team_a_score:11,team_b_score:8,updated_at:'2026-09-08',ladder_batch_group_id:'g1' } as LeagueMatch;
const sub: LeagueMatchSubstitution = { id:'sub-record',league_id:'league',season_id:'season',match_id:'game',slot:'a',in_player_id:'fill',out_player_id:'regular' };
const names: Record<string,string> = {fill:'Jordan Chen',regular:'Alex Morgan',b:'Taylor Brooks',c:'Casey Rivera',d:'Samantha Williams-Robertson'};

describe('human substitute identities', () => {
  it('resolves display, full and composed names consistently', () => {
    expect(leaguePlayerName({display_name:' Jordan ',full_name:'Jordan Chen'})).toBe('Jordan');
    expect(leaguePlayerName({full_name:'Jordan Chen'})).toBe('Jordan Chen');
    expect(leaguePlayerName({first_name:'Jordan',last_name:'Chen'})).toBe('Jordan Chen');
  });
  it.each(['73ff205a','12345678','12345678-abcd-1234-abcd-123456789012'])('skips an opaque identifier %s when a real name exists', id => {
    expect(leaguePlayerName({display_name:id,full_name:'Jordan Chen'})).toBe('Jordan Chen');
    expect(leaguePlayerName({display_name:id})).toBe('Name unavailable');
  });
  it('is honest about a missing profile instead of displaying an ID or claiming deletion', () => {
    expect(leaguePlayerName(null)).toBe('Name unavailable');
    expect(leaguePlayerName({display_name:'  '})).toBe('Name unavailable');
  });
  it('uses italic names and an explicit accessible text badge only for substitutes', () => {
    const html=renderToStaticMarkup(<LeaguePlayerName name="Jordan Chen" isSub replacesName="Alex Morgan" />);
    expect(html).toContain('class="italic"'); expect(html).toContain('>Sub</span>'); expect(html).toContain('For Alex Morgan');
    expect(renderToStaticMarkup(<LeaguePlayerName name="Alex Morgan" />)).not.toContain('>Sub<');
  });
  it('uses per-match records, not a season-wide bench label', () => {
    expect(matchPlayerLabel(game,'fill','Jordan Chen',[sub])).toBe('Jordan Chen (Sub)');
    expect(matchPlayerLabel({...game,id:'other'},'fill','Jordan Chen',[sub])).toBe('Jordan Chen');
    expect(matchSubstitutions(game,[sub])).toEqual([sub]);
    expect(matchSubstitutions({...game,id:'other-game'},[sub])).toEqual([]);
    expect(matchSubstitutions({...game,player_a_id:'regular'},[sub])).toEqual([]);
    expect(matchSubstitutions(game,[{...sub,slot:'b'}])).toEqual([]);
    expect(matchSubstitutions(game,[{...sub,out_player_id:'fill'}])).toEqual([]);
  });
  it('shows the actual fill-in on both team and individual scorecards', () => {
    const render=(teamName?:string)=>renderToStaticMarkup(<LeagueMatchSide match={game} ids={['fill','b']} nameOf={id=>names[id]} substitutions={[sub]} teamName={teamName} />);
    for (const html of [render(),render('ELEVENO Gold')]) {
      expect(html).toContain('Jordan Chen'); expect(html).toContain('>Sub</span>'); expect(html).toContain('Taylor Brooks'); expect(html).not.toContain('Alex Morgan');
    }
    expect(render('ELEVENO Gold')).toContain('ELEVENO Gold');
  });
  it('shows fill-ins in court groups without moving regular ladder seats', () => {
    const seats=['regular','b','c','d'];
    expect(courtPlayerIds(seats,[game])).toEqual(['fill','b','c','d']);
    expect(seats).toEqual(['regular','b','c','d']);
    expect(courtPlayerIds(seats,[])).toEqual(seats);
  });
  it('retains both actual participants when a substitute covers only later games', () => {
    const earlier={...game,id:'earlier',player_a_id:'regular'};
    expect(courtPlayerIds(['regular','b','c','d'],[earlier,game])).toEqual(['regular','b','c','d','fill']);
    expect([...substitutePlayerIds([earlier,game],[sub])]).toEqual(['fill']);
  });
  it('keeps the substitute’s own standings and labels the person who actually played', () => {
    const rows=computePlayerStandings([game],id=>names[id]);
    expect(rows.find(r=>r.teamId==='fill')?.wins).toBe(1); expect(rows.some(r=>r.teamId==='regular')).toBe(false);
    const html=renderToStaticMarkup(<StandingsTable rows={rows} nameHeader="Player" substituteIds={substitutePlayerIds([game],[sub])} />);
    expect(html).toContain('Jordan Chen'); expect(html.match(/>Sub<\/span>/g)).toHaveLength(1);
  });
  it('hydrates ladder identities from actual game slots and substitution records, not just snapshots', () => {
    const source=readFileSync('src/hooks/useLadder.ts','utf8');
    expect(source).toContain('...games.flatMap(matchPlayerIds)');
    expect(source).toContain('...substitutions.flatMap(s => [s.in_player_id, s.out_player_id])');
    expect(source).not.toContain('id.slice(0, 8)');
  });
});

describe('substitution preview scope', () => {
  const batches={g1:{batch_id:'batch1',week_number:2,batch_number:1},g2:{batch_id:'batch2',week_number:2,batch_number:2}};
  const open={...game,player_a_id:'regular',status:'scheduled'};
  it('shows only the earliest affected batch and its exact game count', () => {
    const targets=substitutionTargets([open,{...open,id:'g-next',ladder_batch_group_id:'g2'},{...open,id:'done',status:'verified'}],batches,'fill');
    expect(targets.find(t=>t.id==='regular')).toMatchObject({batchId:'batch1',count:1,scopeLabel:'Week 2 · Batch 1',blockedReason:null});
  });
  it('fails closed if missing batch data would accidentally widen the swap', () => {
    expect(substitutionTargets([open],{},'fill')[0].blockedReason).toContain('Batch details');
  });
  it('blocks an incoming player who is already playing in the same batch', () => {
    expect(substitutionTargets([open,{...game,id:'booked',status:'scheduled'}],batches,'fill')[0].blockedReason).toContain('already playing');
  });
  it('does not block a player whose other assignment is in a later batch', () => {
    expect(substitutionTargets([open,{...game,id:'booked',status:'scheduled',ladder_batch_group_id:'g2'}],batches,'fill').find(t=>t.id==='regular')?.blockedReason).toBeNull();
  });
  it('describes non-ladder scope honestly, excludes finished games and the incoming player', () => {
    const targets=substitutionTargets([{...open,ladder_batch_group_id:null},{...game,status:'verified'}],{},'fill');
    expect(targets[0]).toMatchObject({batchId:null,count:1,scopeLabel:'All unplayed games in this season'});
    expect(targets.some(t=>t.id==='fill')).toBe(false);
  });
});
