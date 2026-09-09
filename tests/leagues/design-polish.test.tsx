import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { StandingsTable } from '@/components/leagues/StandingsTable';
import { LeagueScorecard } from '@/components/leagues/LeagueScorecard';
import { LeaguePageSkeleton } from '@/components/leagues/_leagueScope';
import { LeagueManageNav } from '@/components/admin/leagues/LeagueManageNav';
import { visibleManageTabs } from '@/components/admin/leagues/leagueManageTabs';
import { FormRow, TabSkeleton, EmptyState } from '@/components/admin/leagues/_shared';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StandingRow } from '@/lib/leagues/standings';
import type { LeagueMatch } from '@/lib/leagues/types';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const rows: StandingRow[] = [
  { teamId: 'a', teamName: 'Samantha Williams-Robertson', wins: 12, losses: 3, gamesPlayed: 15, forfeitWins: 0, forfeitLosses: 0, pointsFor: 123, pointsAgainst: 91, pointDiff: 32, avgPointDiff: 2.13, winPct: 0.8, recentForm: ['L', 'W', 'FW', 'FL', 'W'] },
  { teamId: 'b', teamName: 'Jordan Chen', wins: 10, losses: 5, gamesPlayed: 15, forfeitWins: 1, forfeitLosses: 0, pointsFor: 115, pointsAgainst: 100, pointDiff: 15, avgPointDiff: 1, winPct: 2/3, recentForm: ['W'] },
];
const game = { id:'game', player_a_id:'a', player_b_id:'b', player_c_id:'c', player_d_id:'d', team_a_score:11, team_b_score:0, status:'verified' } as LeagueMatch;
const names: Record<string,string> = {a:'Samantha Williams-Robertson', b:'Jordan Chen', c:'Casey Rivera', d:'Taylor Brooks'};

describe('league design presentation contracts', () => {
  it('uses real table headers and keeps the supplied standings order and results', () => {
    const before = structuredClone(rows);
    const html = renderToStaticMarkup(<StandingsTable rows={rows} nameHeader="Player" />);
    expect(html).toContain('<table');
    expect(html).toContain('Player standings, ordered by rank');
    expect(html.match(/scope="col"/g)).toHaveLength(8);
    expect(html.match(/scope="row"/g)).toHaveLength(2);
    expect(html.indexOf(rows[0].teamName)).toBeLessThan(html.indexOf(rows[1].teamName));
    expect(html).toContain('>12</td>'); expect(html).toContain('>+32</td>');
    expect(rows).toEqual(before);
  });
  it('identifies your own row and substitute appearances without relying on color', () => {
    const html = renderToStaticMarkup(<StandingsTable rows={rows} nameHeader="Player" highlightTeamIds={new Set(['a'])} substituteIds={new Set(['b'])} />);
    expect(html.match(/>You<\/span>/g)).toHaveLength(1);
    expect(html.match(/>Sub<\/span>/g)).toHaveLength(1);
    expect(html).toContain('data-highlighted="true"');
    expect(html).toContain('W · Wins'); expect(html).toContain('Point difference');
  });
  it('keeps form history readable to assistive technology', () => {
    const html = renderToStaticMarkup(<StandingsTable rows={rows} />);
    expect(html).toContain('Recent form, oldest to newest: Loss, Win, Won by forfeit, Lost by forfeit, Win');
    expect(html).toContain('1 forfeit wins, 0 forfeit losses');
  });
  it('never invents a table of scores when no standings exist', () => {
    const html = renderToStaticMarkup(<StandingsTable rows={[]} emptyMessage="Awaiting confirmed results." />);
    expect(html).toContain('Awaiting confirmed results.'); expect(html).not.toContain('<table');
  });
  it('keeps zero scores and all four names on player scorecards', () => {
    const html = renderToStaticMarkup(<LeagueScorecard match={game} nameOf={id => names[id]} />);
    Object.values(names).forEach(name => expect(html).toContain(name));
    expect(html).toContain('Score </span>11'); expect(html).toContain('Score </span>0');
    expect(html).not.toContain('Not scored');
  });
  it('uses an honest placeholder until both sides have a score', () => {
    const html = renderToStaticMarkup(<LeagueScorecard match={{...game,team_b_score:null}} nameOf={id => names[id]} teamAName="ELEVENO Gold" />);
    expect(html).toContain('ELEVENO Gold'); expect(html.match(/Not scored/g)).toHaveLength(2);
    expect(html).not.toContain('Score </span>');
  });
  it('links input help text without dropping existing descriptions', () => {
    const html = renderToStaticMarkup(<FormRow label="League name" hint="Visible to your players."><Input id="league-name" aria-describedby="existing-error" /></FormRow>);
    expect(html).toContain('for="league-name"');
    expect(html).toContain('aria-describedby="existing-error league-name-hint"');
    expect(html).toContain('id="league-name-hint"');
  });
  it('links select help text and labels to the trigger', () => {
    const html = renderToStaticMarkup(<FormRow label="Visibility" htmlFor="visibility" hint="Controls discovery."><Select><SelectTrigger><SelectValue /></SelectTrigger></Select></FormRow>);
    expect(html).toContain('aria-labelledby="visibility-label"');
    expect(html).toContain('aria-describedby="visibility-hint"');
  });
  it('keeps the full manager navigation and clearly labels pending items', () => {
    const tabs = visibleManageTabs('ladder');
    const html = renderToStaticMarkup(<LeagueManageNav active="actions" onChange={() => undefined} tabs={tabs} actionCount={4} />);
    tabs.forEach(tab => expect(html).toContain(tab.label.replace('&','&amp;')));
    expect(html).toContain('aria-current="page"'); expect(html).toContain('4 pending items');
  });
  it('announces loading and offers touch-sized empty-state actions', () => {
    const page = renderToStaticMarkup(<LeaguePageSkeleton manager />);
    const section = renderToStaticMarkup(<TabSkeleton />);
    expect(page).toContain('Loading league management'); expect(page).not.toContain('<button');
    expect(section).toContain('role="status"'); expect(section).toContain('motion-safe:animate-pulse');
    expect(renderToStaticMarkup(<EmptyState title="Ready for a season" action={{label:'Create a season',onClick:()=>undefined}} />)).toContain('min-h-11');
  });
});
