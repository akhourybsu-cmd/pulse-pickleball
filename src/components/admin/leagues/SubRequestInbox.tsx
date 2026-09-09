import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LifeBuoy } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLeagueSubRequests } from '@/hooks/useLeagueSubRequests';
import { leagueErrorMessage } from '@/lib/leagues/data';
import { eligibleSubIds, requestableWeeks, subRequestStatus, weekDescription, type SubRequest } from '@/lib/leagues/subRequests';
import { leaguePlayerName as resolvePlayerName } from '@/lib/leagues/playerIdentity';
import { LeaguePlayerName } from '@/components/leagues/LeaguePlayerName';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState, FormRow, FormShell, SegmentedControl, TabSkeleton } from './_shared';

export function SubRequestInbox({ leagueId, seasonId, dataVersion = 0, onMutated }: {
  leagueId: string; seasonId: string; dataVersion?: number; onMutated: () => void;
}) {
  const query = useLeagueSubRequests(leagueId, seasonId, dataVersion);
  const [review, setReview] = useState<SubRequest | null>(null);
  if (query.isPending) return <TabSkeleton lines={2} />;
  if (query.error) return <EmptyState title="Couldn't load requests" desc={leagueErrorMessage(query.error)} action={{ label: 'Retry requests', onClick: () => void query.refetch() }} />;
  const rows = query.data.requests.filter(r => r.status !== 'canceled').sort((a, b) =>
    Number(b.status === 'pending') - Number(a.status === 'pending') || a.week_number - b.week_number);
  return <section className="lg-card space-y-4 p-4 sm:p-5">
    <div><h2 className="text-lg font-semibold">Player requests</h2><p className="mt-1 text-sm text-muted-foreground">Arrange coverage before drawing the week. The bench below is your pool of fill-in players.</p></div>
    {!rows.length ? <p className="text-sm text-muted-foreground">No substitute requests for this season.</p> : <ul className="divide-y divide-border">
      {rows.map(request => <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0"><p className="font-semibold break-words">{resolvePlayerName(query.data.profiles[request.player_id])} · Week {request.week_number}</p><p className="text-sm text-muted-foreground">{subRequestStatus(request.status)}</p>{request.status === 'sub' && request.assigned_sub_id && <p className="mt-1 text-sm"><LeaguePlayerName name={resolvePlayerName(query.data.profiles[request.assigned_sub_id])} isSub replacesName={resolvePlayerName(query.data.profiles[request.player_id])} /></p>}</div>
        <Button variant="outline" className="h-11 rounded-xl" onClick={() => setReview(request)}>{request.status === 'pending' ? 'Review request' : 'View arrangement'}</Button>
      </li>)}
    </ul>}
    {review && <ReviewSubRequestDialog request={review} playerName={query.data.profiles[review.player_id] ? resolvePlayerName(query.data.profiles[review.player_id]) : 'Player'} onClose={() => setReview(null)} onMutated={onMutated} />}
  </section>;
}

export function ReviewSubRequestDialog({ request, playerName, onClose, onMutated }: {
  request: SubRequest; playerName: string; onClose: () => void; onMutated: () => void;
}) {
  const query = useLeagueSubRequests(request.league_id, request.season_id);
  const client = useQueryClient();
  const [resolution, setResolution] = useState('sub');
  const [subId, setSubId] = useState('');
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [mode, setMode] = useState<'resolve' | 'reopen' | 'cancel'>('resolve');
  const inFlight = useRef(false);
  const data = query.data;
  const latest = data?.requests.find(r => r.id === request.id);
  const week = data?.weeks.find(w => w.id === request.session_id);
  const available = data && latest ? eligibleSubIds(data.candidateIds, data.order, data.requests, latest,
    data.sitouts.filter(s => s.week_number === request.week_number).map(s => s.player_id)) : [];
  const candidates = available.map(id => ({ id, name: data?.profiles[id] ? resolvePlayerName(data.profiles[id]) : 'Player' })).sort((a, b) => a.name.localeCompare(b.name));
  const validWeek = !!data && !!week && requestableWeeks([week], data.generated, new Date().toISOString().slice(0, 10)).length > 0;
  const actionable = !!latest && latest.status === 'pending' && validWeek;
  const canSave = !query.isFetching && !query.error && (mode === 'resolve'
    ? actionable && (resolution !== 'sub' || available.includes(subId))
    : !!latest && !data?.generated.has(request.week_number) && (mode === 'reopen' ? validWeek && ['sub', 'sitout', 'declined'].includes(latest.status) : latest.status === 'pending'));
  const present = data ? data.order.length - data.sitouts.filter(s => s.week_number === request.week_number && data.order.includes(s.player_id)).length : 0;
  const afterSitout = present - (data?.order.includes(request.player_id) && !data.sitouts.some(s => s.week_number === request.week_number && s.player_id === request.player_id) ? 1 : 0);
  const submit = async () => {
    if (!canSave || inFlight.current) return;
    inFlight.current = true; setSaving(true); setSaveError(null);
    try {
      const { error } = mode !== 'resolve' ? await supabase.rpc((mode === 'reopen' ? 'reopen_ladder_sub_request' : 'cancel_ladder_sub_request') as never, { p_request_id: request.id } as never) : await supabase.rpc('resolve_ladder_sub_request' as never, {
        p_request_id: request.id, p_resolution: resolution, p_assigned_sub_id: resolution === 'sub' ? subId : null, p_note: note.trim() || null,
      } as never);
      if (error) throw error;
      for (const key of ['league-actions', 'league-sub-requests', 'player-league-detail']) void client.invalidateQueries({ queryKey: [key] });
      toast.success(mode === 'reopen' ? 'Request reopened. Choose a new arrangement from the inbox.' : mode === 'cancel' ? 'Request closed. The player has been notified.' : 'Decision saved. The player has been notified.'); onMutated(); onClose();
    } catch (error) { setSaveError(leagueErrorMessage(error)); void query.refetch(); }
    finally { inFlight.current = false; setSaving(false); }
  };
  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <FormShell icon={<LifeBuoy className="h-5 w-5" />} kicker="Player request" title={`Cover for ${playerName}`} subtitle={week ? weekDescription(week) : `Week ${request.week_number}`}
      primaryLabel={mode === 'reopen' ? 'Confirm reopen' : mode === 'cancel' ? 'Confirm cancellation' : 'Confirm decision'} primaryDisabled={!canSave} primaryLoading={saving} onPrimary={submit}
      secondary={<Button variant="outline" className="h-12 rounded-xl" disabled={saving} onClick={onClose}>Cancel</Button>}>
      {query.isPending ? <TabSkeleton lines={3} /> : query.error ? <EmptyState title="Couldn't load the latest roster" desc={leagueErrorMessage(query.error)} action={{ label: 'Retry roster', onClick: () => void query.refetch() }} /> : mode !== 'resolve' ? <div role="status" className="rounded-xl bg-muted p-4 text-sm leading-relaxed">
        {mode === 'reopen' ? 'This removes the current fill-in or sit-out arrangement and puts the request back in Actions. The player will be notified that coverage is not confirmed. Resolve it again before drawing the week.' : 'This closes the outstanding request without arranging coverage. The player will be notified; coordinate their availability directly.'}
        <Button variant="outline" className="mt-3 h-11" disabled={saving} onClick={() => setMode('resolve')}>Go back</Button>
      </div> : !actionable ? <div role="status" className="space-y-3 text-sm">
        <p className="font-semibold">{latest ? subRequestStatus(latest.status) : 'Request unavailable'}</p>
        {latest?.status === 'sub' && latest.assigned_sub_id && <div className="rounded-xl border border-border bg-muted/40 p-3"><LeaguePlayerName name={resolvePlayerName(data?.profiles[latest.assigned_sub_id])} isSub replacesName={playerName} /></div>}
        {latest?.note && <p className="whitespace-pre-wrap break-words">Player’s note: {latest.note}</p>}
        <p className="text-muted-foreground">{data?.generated.has(request.week_number) ? 'This week has been drawn. This is the original pre-draw arrangement; the match list shows who is currently playing. For later changes, use Substitutes → Swap in for unplayed games.' : latest?.status === 'pending' ? 'This week is no longer open for pre-draw decisions.' : 'The saved arrangement is shown here. The regular player keeps their ladder position.'}</p>
        {latest?.resolution_note && <p className="whitespace-pre-wrap break-words">Organizer message: {latest.resolution_note}</p>}
        {latest && validWeek && ['sub', 'sitout', 'declined'].includes(latest.status) && <Button variant="outline" className="h-11" onClick={() => setMode('reopen')}>Change arrangement</Button>}
        {latest?.status === 'pending' && !data?.generated.has(request.week_number) && <Button variant="outline" className="h-11" onClick={() => setMode('cancel')}>Close this request</Button>}
      </div> : <>
        <SubRequestDecisionFields playerNote={latest?.note} resolution={resolution} onResolution={v => { setResolution(v); setSaveError(null); }}
          candidates={candidates} subId={subId} onSubId={setSubId} search={search} onSearch={setSearch}
          note={note} onNote={setNote} afterSitout={afterSitout} />
      </>}
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
    </FormShell>
  </Dialog>;
}

/** Shared, side-effect-free decision fields for the real dialog and visual QA. */
export function SubRequestDecisionFields({ playerNote, resolution, onResolution, candidates, subId, onSubId, search, onSearch, note, onNote, afterSitout }: {
  playerNote?: string | null; resolution: string; onResolution: (value: string) => void;
  candidates: { id: string; name: string }[]; subId: string; onSubId: (value: string) => void;
  search: string; onSearch: (value: string) => void; note: string; onNote: (value: string) => void; afterSitout: number;
}) {
  return <>        {playerNote && <div className="rounded-xl bg-muted p-3 text-sm"><p className="mb-1 font-semibold">Player’s note</p><p className="whitespace-pre-wrap break-words">{playerNote}</p></div>}
        <FormRow label="How should this be handled?"><SegmentedControl value={resolution} onChange={v => { onResolution(v); }} options={[{ value: 'sub', label: 'Assign sub' }, { value: 'sitout', label: 'Sit out' }, { value: 'declined', label: 'Decline' }]} /></FormRow>
        {resolution === 'sub' && <FormRow label="Choose a fill-in" hint="Only active players off the ladder, not absent or already covering this week. Confirm availability with the fill-in before assigning them.">
          <div className="space-y-2">
            <Input className="min-h-11 rounded-xl" aria-label="Search eligible substitutes" placeholder="Search by name" value={search} onChange={e => onSearch(e.target.value)} />
            <div className="max-h-48 overflow-y-auto overscroll-contain space-y-1">
              {candidates.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => <button key={c.id} type="button" aria-pressed={subId === c.id} onClick={() => onSubId(c.id)} className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border p-3 text-left text-sm ${subId === c.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}><LeaguePlayerName name={c.name} isSub />{subId === c.id && <CheckCircle2 className="h-4 w-4 shrink-0" />}</button>)}
            </div>
            {!candidates.length && <p className="text-sm text-muted-foreground">No eligible fill-ins. Add an available player to the Substitutes bench, then return here.</p>}
            {!!candidates.length && !candidates.some(c => c.name.toLowerCase().includes(search.toLowerCase())) && <p className="text-sm text-muted-foreground">No names match your search.</p>}
          </div>
        </FormRow>}
        <div className="rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed" role="status">
          {resolution === 'sub' ? 'The fill-in takes this player’s games when the week is drawn. The regular player keeps their ladder position; the player count stays the same.' : resolution === 'sitout' ? `The player keeps their position and returns next week. Based on the current ladder, ${Math.max(0, afterSitout)} players would play.${afterSitout < 4 || afterSitout % 4 !== 0 ? ' The roster needs adjusting to complete groups of four before drawing.' : ' The roster still forms complete groups of four.'}` : 'No coverage will be arranged. The player stays in the draw. Explain the decision below and coordinate with them if they still cannot attend.'}
        </div>
        <FormRow label="Message to the player" hint="Saved with the decision; their original note stays unchanged."><Textarea value={note} maxLength={1000} onChange={e => onNote(e.target.value)} rows={3} placeholder="Explain the arrangement or next step…" /></FormRow>
</>;
}
