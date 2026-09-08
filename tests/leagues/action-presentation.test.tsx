import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { SubRequestDecisionFields } from '@/components/admin/leagues/SubRequestInbox';
import { ActionsTab } from '@/components/admin/leagues/ActionsTab';
import type { useLeagueActions } from '@/hooks/useLeagueActions';

// These are side-effect-free presentation checks in Node, not a browser auth
// session or integration test. Database mutations are tested with PGlite.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

const noop = () => undefined;
const fields = (resolution = 'sub', search = '', candidates = [{ id:'jordan', name:'Jordan Chen' }]) => renderToStaticMarkup(
  <SubRequestDecisionFields playerNote="Away on Tuesday" resolution={resolution} onResolution={noop} candidates={candidates}
    subId="jordan" onSubId={noop} search={search} onSearch={noop} note="Confirmed coverage" onNote={noop} afterSitout={31} />);
describe('substitute decision presentation', () => {
  it('separates the player note and manager message with accessible controls', () => {
    const html=fields(); expect(html).toContain('Away on Tuesday'); expect(html).toContain('Message to the player');
    expect(html).toContain('aria-label="Search eligible substitutes"'); expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('Confirm availability with the fill-in before assigning them.');
  });
  it('explains incomplete foursomes before confirming a sit-out', () => {
    const html=fields('sitout'); expect(html).toContain('31 players would play'); expect(html).toContain('roster needs adjusting');
    expect(html).not.toContain('Search eligible substitutes');
  });
  it('makes the implications of declining explicit', () => {
    expect(fields('declined')).toContain('The player stays in the draw');
  });
  it('distinguishes an empty bench from a search with no matches', () => {
    expect(fields('sub','',[])).toContain('No eligible fill-ins');
    const html=fields('sub','Nonexistent'); expect(html).toContain('No names match your search'); expect(html).not.toContain('Jordan Chen');
  });
});

describe('manager Actions page presentation', () => {
  const render = (overrides: Record<string,unknown> = {}) => renderToStaticMarkup(<ActionsTab query={{
    isPending:false,isFetching:false,error:null,refetch:noop,
    data:{total:0,requests:[],members:[],disputes:[],scores:[],seasons:[{id:'season',name:'Autumn'}],profiles:{}},...overrides,
  } as unknown as ReturnType<typeof useLeagueActions>} onNavigate={noop} onMutated={noop} />);
  it('does not turn a failed read into an all-clear', () => {
    const html=render({error:new Error('Connection unavailable')}); expect(html).toContain('Retry actions'); expect(html).not.toContain('all caught up');
  });
  it('only shows an all-clear after a successful empty result', () => { expect(render()).toContain('all caught up'); });
  it('directs a brand-new organizer to create a season', () => {
    expect(render({data:{total:0,requests:[],members:[],disputes:[],scores:[],seasons:[],profiles:{}}})).toContain('Set up your first season');
  });
});
