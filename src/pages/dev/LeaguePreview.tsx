/** Development-only visual harness. Uses real shared league components with
 * synthetic data; no league records, scores or settings are written. */
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { CalendarDays, Plus, Settings, Trophy, Users } from 'lucide-react';
import { LeagueScope, LeagueHero, LgSectionHeader } from '@/components/leagues/_leagueScope';
import { LeagueManageNav } from '@/components/admin/leagues/LeagueManageNav';
import { visibleManageTabs, type ManageTab } from '@/components/admin/leagues/leagueManageTabs';
import { FormRow, FormSection, FormShell, SectionHeader, SeasonSelect, SegmentedControl, FIELD_H } from '@/components/admin/leagues/_shared';
import { StandingsTable } from '@/components/leagues/StandingsTable';
import type { StandingRow } from '@/lib/leagues/standings';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ActionsTab } from '@/components/admin/leagues/ActionsTab';
import { SubRequestDecisionFields } from '@/components/admin/leagues/SubRequestInbox';
import type { useLeagueActions } from '@/hooks/useLeagueActions';

const league = { name: 'ELEVENO Autumn Ladder', description: 'Good games. Familiar faces. A little friendly competition, every Tuesday.', location: 'ELEVENO · Attleboro, MA', league_type: 'ladder', status: 'active', visibility: 'admin_only', rating_eligible: true, guests_allowed: true } as const;
const seasons = [{ id: 'autumn', name: 'Autumn 2026 · Tuesday evenings' }, { id: 'summer', name: 'Summer 2026 · Thursday evenings' }];
const rows: StandingRow[] = ['Alex Morgan', 'Jordan Chen', 'Samantha Williams-Robertson', 'Taylor Brooks', 'Casey Rivera'].map((name, i) => ({ teamId: String(i), teamName: name, wins: 8 - i, losses: i + 1, forfeitWins: 0, forfeitLosses: 0, gamesPlayed: 9, pointsFor: 91 - i, pointsAgainst: 72 + i, pointDiff: 19 - 2 * i, avgPointDiff: 2.1, winPct: (8-i)/9, recentForm: ['W','L','W','W','W'] }));

export default function LeaguePreview() {
  const { resolvedTheme, setTheme } = useTheme();
  const [active, setActive] = useState<ManageTab>('actions');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resolution, setResolution] = useState('sub');
  const [fillIn, setFillIn] = useState('');
  const [subSearch, setSubSearch] = useState('');
  const [managerNote, setManagerNote] = useState('');
  const [open, setOpen] = useState(false);
  const [season, setSeason] = useState('autumn');
  const [status, setStatus] = useState('active');
  const [mode, setMode] = useState('organizer');
  const [name, setName] = useState(league.name as string);
  const [visibility, setVisibility] = useState('private');
  const actionFixture = { isPending: false, isFetching: false, error: null, refetch: async () => undefined,
    data: { total: 4, requests: [{id:'preview-request',league_id:'preview',season_id:'autumn',session_id:'week4',week_number:4,player_id:'alex',status:'pending',note:'Away next Tuesday. Thank you for helping arrange coverage.',created_at:'2026-09-08T12:00:00Z'}],
      disputes:[{id:'preview-dispute',season_id:'autumn'}],scores:[{id:'preview-score',season_id:'autumn'}],members:[{id:'preview-member',season_id:'autumn'}],seasons,
      profiles:{alex:{id:'alex',display_name:'Samantha Williams-Robertson'}} } } as unknown as ReturnType<typeof useLeagueActions>;
  const form = <>
    <FormSection label="League details" hint="Players see these details on your league page.">
      <FormRow label="League name" required><Input value={name} onChange={e => setName(e.target.value)} className={FIELD_H} /></FormRow>
      <FormRow label="Description"><Textarea defaultValue={league.description} rows={3} /></FormRow>
    </FormSection>
    <FormSection label="Registration">
      <FormRow label="Status"><SegmentedControl value={status} onChange={setStatus} options={[{value:'draft',label:'Draft'},{value:'active',label:'Active'},{value:'archived',label:'Archived'}]} /></FormRow>
      <FormRow label="Visibility"><Select value={visibility} onValueChange={setVisibility}><SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger><SelectContent className="league-menu"><SelectItem value="private">Private · invitation only</SelectItem><SelectItem value="public">Public · listed for players</SelectItem></SelectContent></Select></FormRow>
    </FormSection>
  </>;
  return <LeagueScope>
    <div className="mx-auto max-w-[1440px] space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Design preview · synthetic data only</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11" onClick={() => setMode(mode === 'organizer' ? 'player' : 'organizer')}>{mode === 'organizer' ? 'Player view' : 'Organizer view'}</Button>
          <Button variant="outline" className="h-11" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>Toggle preview theme</Button>
        </div>
      </div>
      {active === 'actions' && mode === 'organizer' ? <section className="lg-hero-gradient rounded-2xl p-5 sm:p-6"><p className="text-sm text-[color:var(--lg-hero-text-dim)]">League management</p><h1 className="mt-1 break-words text-2xl sm:text-3xl font-semibold text-[color:var(--lg-hero-text)]">{league.name}</h1><p className="mt-2 text-sm text-[color:var(--lg-hero-text-dim)]">Your requests, roster decisions and results in one place.</p></section> : <LeagueHero league={league} managerName="Alex Morgan" kpis={[{icon: CalendarDays,label:'Season',value:'Autumn · Tuesdays'},{icon:Users,label:'Players',value:32},{icon:Trophy,label:'Week',value:'3 of 8'}]} />}
      {mode === 'organizer' ? <div className="flex flex-col gap-5 lg:flex-row lg:gap-7">
        <LeagueManageNav active={active} onChange={setActive} tabs={visibleManageTabs('ladder')} />
        <main className="min-w-0 flex-1 space-y-5">
          {active !== 'actions' && <><SectionHeader title={visibleManageTabs('ladder').find(t => t.key === active)?.label ?? 'League settings'} hint="Keep your season organized and your players informed." actions={<Button className="h-11 rounded-xl" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Open league editor</Button>} />
          <SeasonSelect seasons={seasons} value={season} onChange={setSeason} className="sm:max-w-sm" /></>}
          {active === 'actions' ? <ActionsTab query={actionFixture} onNavigate={setActive} onMutated={() => undefined} onReview={() => setReviewOpen(true)} /> : active === 'overview' ? <section className="lg-card space-y-5 p-4 sm:p-6">{form}</section> : <StandingsTable rows={rows} nameHeader="Player" />}
        </main>
      </div> : <div className="space-y-5">
        <SeasonSelect seasons={seasons} value={season} onChange={setSeason} className="sm:max-w-sm" />
        <section className="lg-card p-4 sm:p-6"><LgSectionHeader icon={Trophy}>Season standings</LgSectionHeader><p className="mb-4 text-sm text-muted-foreground">Confirmed results only. Your next matches are scheduled for Tuesday.</p><StandingsTable rows={rows} nameHeader="Player" /></section>
      </div>}
      <Dialog open={open} onOpenChange={setOpen}><FormShell icon={<Settings className="h-5 w-5" />} title="League settings" kicker="Organizer tools" subtitle="Make it easy for players to know when and where to play." primaryLabel="Done with preview" onPrimary={() => setOpen(false)} secondary={<Button variant="outline" className="h-12 rounded-xl" onClick={() => setOpen(false)}>Cancel</Button>}>{form}</FormShell></Dialog>
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><FormShell icon={<Users className="h-5 w-5" />} title="Cover for Samantha Williams-Robertson" kicker="Player request · preview" subtitle="Week 4 · Tue, Sep 22 · 18:00" primaryLabel="Confirm preview decision" primaryDisabled={resolution === 'sub' && !fillIn} onPrimary={() => setReviewOpen(false)} secondary={<Button variant="outline" className="h-12 rounded-xl" onClick={() => setReviewOpen(false)}>Cancel</Button>}>
        <SubRequestDecisionFields playerNote="Away next Tuesday. Thank you for helping arrange coverage." resolution={resolution} onResolution={setResolution} candidates={[{id:'jordan',name:'Jordan Chen'},{id:'taylor',name:'Taylor Brooks'},{id:'casey',name:'Casey Rivera'}]} subId={fillIn} onSubId={setFillIn} search={subSearch} onSearch={setSubSearch} note={managerNote} onNote={setManagerNote} afterSitout={31} />
      </FormShell></Dialog>
    </div>
  </LeagueScope>;
}
