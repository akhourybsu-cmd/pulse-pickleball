import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LeagueScope, LeagueHero } from '@/components/leagues/_leagueScope';
import { LeagueManageNav } from '@/components/admin/leagues/LeagueManageNav';
import { visibleManageTabs } from '@/components/admin/leagues/leagueManageTabs';
import { FormRow, SegmentedControl, SectionHeader } from '@/components/admin/leagues/_shared';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nextChoiceIndex } from '@/lib/leagues/choiceNavigation';

describe('PULSE league presentation', () => {
  it('preserves readable league and section capitalization', () => {
    const html = renderToStaticMarkup(<LeagueScope>
      <LeagueHero league={{ name: 'ELEVENO Autumn Ladder', description: null, location: null, league_type: 'ladder', status: 'active', visibility: 'admin_only', rating_eligible: false, guests_allowed: false }} />
      <SectionHeader title="Manage players" />
    </LeagueScope>);
    expect(html).toContain('ELEVENO Autumn Ladder');
    expect(html).toContain('Manage players');
    expect(html).not.toContain('ELEVENO AUTUMN LADDER');
  });

  it('uses app fonts and semantic surface tokens, without the condensed font download', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const leagueCSS = css.slice(css.indexOf('/* League surfaces'), css.indexOf('iMessage-style'));
    expect(css).not.toMatch(/Bebas|Barlow/);
    expect(leagueCSS).toContain("'Manrope'");
    expect(leagueCSS).toContain("'Sora'");
    expect(leagueCSS).toContain('--lg-surface: hsl(var(--card))');
    expect(leagueCSS).not.toMatch(/--(?:background|foreground|primary):/);
    expect(leagueCSS).toContain('.league-menu');
  });

  it('renders only relevant organizer sections and announces the active one', () => {
    const html = renderToStaticMarkup(<LeagueManageNav active="ladder" onChange={() => {}} tabs={visibleManageTabs('ladder')} />);
    expect(html).toContain('aria-current="page"');
    expect(html).toContain('Ladder &amp; weeks');
    expect(html).toContain('Substitutes');
    expect(html).not.toContain('Fixed pairs or rosters');
    expect(html).not.toContain('Nights of scheduled play');
  });

  it('handles an empty navigation model', () => {
    expect(renderToStaticMarkup(<LeagueManageNav active="overview" onChange={() => {}} tabs={[]} />)).toBe('');
  });

  it('connects a field label to an existing input id', () => {
    const html = renderToStaticMarkup(<FormRow label="League name"><Input id="league-name" /></FormRow>);
    expect(html).toContain('for="league-name"');
  });

  it('labels portalled select triggers from their form row', () => {
    const html = renderToStaticMarkup(<FormRow label="Visibility" htmlFor="visibility"><Select><SelectTrigger><SelectValue /></SelectTrigger></Select></FormRow>);
    expect(html).toContain('id="visibility-label"');
    expect(html).toContain('aria-labelledby="visibility-label"');
    expect(html).toContain('id="visibility"');
  });

  it('names radio groups and exposes only the selected item to Tab', () => {
    const html = renderToStaticMarkup(<FormRow label="Status"><SegmentedControl value="active" onChange={() => {}} options={[{value:'draft',label:'Draft'},{value:'active',label:'Active'}]} /></FormRow>);
    expect(html).toContain('aria-label="Status"');
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
    expect(html.match(/tabindex="-1"/g)).toHaveLength(1);
  });
});

describe('league choice keyboard navigation', () => {
  it.each([
    ['ArrowRight', 2, 0], ['ArrowDown', 0, 1], ['ArrowLeft', 0, 2],
    ['ArrowUp', 2, 1], ['Home', 2, 0], ['End', 0, 2],
    ['Tab', 1, null], ['Enter', 1, null],
  ])('%s from %s moves to %s', (key, index, expected) => {
    expect(nextChoiceIndex(key, index as number, 3)).toBe(expected);
  });
  it('handles an empty option set', () => expect(nextChoiceIndex('ArrowRight', 0, 0)).toBeNull());
});
