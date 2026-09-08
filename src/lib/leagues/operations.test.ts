import { describe, expect, it } from 'vitest';
import { canManageLeague, ladderActivationIssues, needsMatchAction, parseWholeNumber, selectLeagueSeason, selectSeasonMembership, validateMatchInputs, validateScorePair, validateSeasonDates, validateSessionInputs } from './operations';
import { computePlayerStandings, computeTeamStandings } from './standings';
import type { LeagueMatch, LeagueMember, LeagueSeason, LeagueSession, LeagueTeam } from './types';

const season = (id: string, status: LeagueSeason['status'], start_date = '2026-01-01') => ({id,status,start_date,created_at:start_date}) as LeagueSeason;
const member = (season_id: string | null, role: LeagueMember['role']='player', status: LeagueMember['status']='active') => ({season_id,role,status,user_id:'me'}) as LeagueMember;
const match = (patch: Partial<LeagueMatch> = {}) => ({id:'match',season_id:'current',status:'verified',team_a_id:'a',team_b_id:'b',team_a_score:11,team_b_score:7,player_a_id:'p1',player_b_id:null,player_c_id:'p2',player_d_id:null,updated_at:'2026-09-01',...patch}) as LeagueMatch;
const teams = [{id:'a',name:'A',season_id:'current'},{id:'b',name:'B',season_id:'current'}] as LeagueTeam[];

describe('league season and role context',()=>{
  const seasons=[season('old','completed'),season('future','draft','2027-01-01'),season('current','active')];
  it('prefers an active season over a newer draft',()=>expect(selectLeagueSeason(seasons)?.id).toBe('current'));
  it('preserves explicit historical season links',()=>expect(selectLeagueSeason(seasons,'old')?.id).toBe('old'));
  it('recovers from a stale season link',()=>expect(selectLeagueSeason(seasons,'deleted')?.id).toBe('current'));
  it('supports multiple memberships without selecting a stale one',()=>expect(selectSeasonMembership([member('old','manager'),member('current')],'current')?.role).toBe('player'));
  it('preserves league-wide manager membership',()=>expect(selectSeasonMembership([member(null,'manager')],'current')?.role).toBe('manager'));
  it('recognizes assistants even when also enrolled as a player elsewhere',()=>expect(canManageLeague('owner','me',[member('old','manager'),member('current')])).toBe(true));
  it('does not grant management to pending/removed managers or captains',()=>expect(canManageLeague('owner','me',[member('s','manager','removed'),member('s','captain')])).toBe(false));
  it('handles empty leagues',()=>expect(selectLeagueSeason([])).toBeNull());
});
describe('league form validation',()=>{
  it.each(['',' ','-1','1.5','NaN','Infinity','1e3','2147483648'])('rejects invalid integer %s',v=>expect(parseWholeNumber(v)).toBeNull());
  it('accepts zero as a valid score',()=>expect(validateScorePair('11','0',true)).toBeNull());
  it('requires both scores and a winner',()=>{
    expect(validateScorePair('11','')).toBeTruthy(); expect(validateScorePair('11','11')).toBeTruthy();
    expect(validateScorePair('','',true)).toBeTruthy(); expect(validateScorePair('','')).toBeNull();
  });
  it('validates season dates',()=>{
    expect(validateSeasonDates('2026-10-01','2026-09-01','')).toBeTruthy();
    expect(validateSeasonDates('','2026-09-01','2026-09-02')).toBeTruthy();
    expect(validateSeasonDates('2026-09-01','2026-09-01','2026-09-01')).toBeNull();
  });
  it('validates session time ranges and courts',()=>{
    expect(validateSessionInputs('18:00','17:00','4')).toBeTruthy();
    expect(validateSessionInputs('','19:00','4')).toBeTruthy();
    expect(validateSessionInputs('18:00','19:00','1.5')).toBeTruthy();
    expect(validateSessionInputs('18:00','19:00','4')).toBeNull();
  });
  const draft={seasonId:'current',session:{season_id:'current',court_count:2} as LeagueSession,court:'2',players:['a','b','c','d'],teamA:null,teamB:null,scoreA:'',scoreB:'',status:'scheduled' as const};
  it('allows a valid unscored matchup',()=>expect(validateMatchInputs(draft)).toBeNull());
  it('rejects duplicate slots, self-play, wrong session, and unavailable courts',()=>{
    expect(validateMatchInputs({...draft,players:['a','a']})).toMatch('only once');
    expect(validateMatchInputs({...draft,teamA:'a',teamB:'a'})).toMatch('itself');
    expect(validateMatchInputs({...draft,seasonId:'different'})).toMatch('session');
    expect(validateMatchInputs({...draft,court:'3'})).toMatch('court');
  });
  it.each(['scheduled','in_progress','score_submitted','disputed'] as const)('keeps %s actionable, even when overdue',status=>expect(needsMatchAction(match({status,scheduled_time:'2000-01-01'}))).toBe(true));
  it.each(['verified','forfeit','canceled'] as const)('moves %s into history',status=>expect(needsMatchAction(match({status}))).toBe(false));
});

describe('ladder activation guidance',()=>{
  it('permits an active league and season',()=>expect(ladderActivationIssues('active',{status:'active'})).toEqual([]));
  it.each(['draft','archived'] as const)('routes an inactive league (%s) to Overview',status=>{
    expect(ladderActivationIssues(status,{status:'active'})).toEqual([{tab:'overview',label:'Review league status',message:expect.stringContaining(`league is ${status}`)}]);
  });
  it.each(['draft','completed','archived'] as const)('routes an inactive season (%s) to Seasons',status=>{
    expect(ladderActivationIssues('active',{status})).toEqual([{tab:'seasons',label:'Review season status',message:expect.stringContaining(`season is ${status}`)}]);
  });
  it('explains both blockers and fails closed while the season is unavailable',()=>{
    expect(ladderActivationIssues('draft',{status:'draft'}).map(i=>i.tab)).toEqual(['overview','seasons']);
    expect(ladderActivationIssues('active')).toHaveLength(1);
  });
});
describe('official standings',()=>{
  it('counts verified scores identically for players and teams',()=>{
    const byTeam=computeTeamStandings([match()],teams), byPlayer=computePlayerStandings([match()],id=>id);
    expect(byTeam.map(r=>[r.wins,r.losses,r.pointDiff])).toEqual([[1,0,4],[0,1,-4]]);
    expect(byPlayer.map(r=>[r.wins,r.losses,r.pointDiff])).toEqual([[1,0,4],[0,1,-4]]);
  });
  it.each(['score_submitted','disputed','scheduled','canceled'] as const)('does not count %s scores',status=>{
    expect(computeTeamStandings([match({status})],teams)).toEqual([]);
    expect(computePlayerStandings([match({status})],id=>id)).toEqual([]);
  });
  it('keeps seasons separate',()=>expect(computeTeamStandings([match({season_id:'old'})],teams,{seasonId:'current'})).toEqual([]));
  it('records a forfeit without inventing points',()=>{
    const rows=computeTeamStandings([match({status:'forfeit',forfeit_winner_team_id:'b'})],teams);
    expect(rows[0]).toMatchObject({teamId:'b',wins:1,forfeitWins:1,pointsFor:0,pointsAgainst:0});
  });
  it('ignores an invalid forfeit winner from legacy data',()=>expect(computeTeamStandings([match({status:'forfeit',forfeit_winner_team_id:'other'})],teams)).toEqual([]));
});
