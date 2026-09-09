import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useLeagueSubRequests } from '@/hooks/useLeagueSubRequests';
import { leagueErrorMessage } from '@/lib/leagues/data';
import { requestableWeeks, subRequestStatus, weekDescription } from '@/lib/leagues/subRequests';
import { leaguePlayerName as resolvePlayerName } from '@/lib/leagues/playerIdentity';
import { LeaguePlayerName } from './LeaguePlayerName';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog } from '@/components/ui/dialog';
import { FormRow, FormShell } from '@/components/admin/leagues/_shared';

export function LadderSubRequestCard({ leagueId, seasonId, currentUserId, canRequest = false }: {
  leagueId: string; seasonId: string | null; currentUserId: string | null; canRequest?: boolean;
}) {
  const query = useLeagueSubRequests(leagueId, seasonId, 0, currentUserId ?? '');
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pickWeek, setPickWeek] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  useEffect(() => { setOpen(false); setPickWeek(''); setNote(''); setError(null); }, [seasonId, currentUserId]);
  if (!seasonId || !currentUserId) return null;
  if (query.isPending) return <p role="status" className="text-sm text-muted-foreground">Checking substitute requests…</p>;
  if (query.error) return <div className="lg-card space-y-2 p-4" role="alert"><p className="text-sm">Your substitute requests could not be loaded.</p><Button variant="outline" onClick={() => void query.refetch()}>Retry requests</Button></div>;
  const { requests, weeks, generated, profiles } = query.data;
  const today = new Date().toISOString().slice(0, 10);
  const available = canRequest ? requestableWeeks(weeks, generated, today).filter(w =>
    !requests.some(r => r.session_id === w.id && ['pending', 'sub', 'sitout'].includes(r.status))) : [];
  const shown = requests.filter(r => r.status !== 'canceled').sort((a, b) => a.week_number - b.week_number);
  const locked = weeks.filter(w => w.week_number && generated.has(w.week_number) && w.status === 'published' && (!w.scheduled_date || w.scheduled_date >= today));
  const mutate = async (cancelId?: string) => {
    if (inFlight.current || (!cancelId && !available.some(w => w.id === pickWeek))) return;
    inFlight.current = true; setBusy(true); setError(null);
    try {
      const result = cancelId
        ? await supabase.rpc('cancel_ladder_sub_request' as never, { p_request_id: cancelId } as never)
        : await supabase.rpc('request_ladder_sub' as never, { p_season_id: seasonId, p_session_id: pickWeek, p_note: note.trim() || null } as never);
      if (result.error) throw result.error;
      toast.success(cancelId ? 'Request canceled. You remain available to play.' : 'Request sent. Your organizer will review it.');
      setOpen(false); setPickWeek(''); setNote('');
      for (const key of ['league-sub-requests', 'league-actions', 'player-league-detail']) void client.invalidateQueries({ queryKey: [key] });
    } catch (err) { setError(leagueErrorMessage(err)); void query.refetch(); }
    finally { inFlight.current = false; setBusy(false); }
  };
  return <section className="lg-card p-4 sm:p-5 space-y-4" aria-label="My substitute requests">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-lg font-semibold"><CalendarClock className="h-5 w-5" />Can’t make a week?</h2><p className="mt-1 text-sm text-muted-foreground">Request coverage and follow your organizer’s decision here.</p></div>
      {!!available.length && <Button className="h-11 rounded-xl" onClick={() => { setPickWeek(available[0].id); setNote(''); setError(null); setOpen(true); }}>Request a sub</Button>}
    </div>
    {!!shown.length && <ul className="divide-y divide-border">{shown.map(request => {
      const week = weeks.find(w => w.id === request.session_id);
      return <li key={request.id} className="space-y-2 py-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{week ? weekDescription(week) : `Week ${request.week_number}`}</p><span className="rounded-full bg-muted px-3 py-1 font-medium">{subRequestStatus(request.status)}</span></div>
        {request.status === 'sub' && <p><LeaguePlayerName name={resolvePlayerName(request.assigned_sub_id ? profiles[request.assigned_sub_id] : null)} isSub /> was arranged for you. {generated.has(request.week_number) ? 'This is your original pre-draw arrangement. Check the match list or organizer for later changes.' : 'You keep your ladder position.'}</p>}
        {request.status === 'sitout' && <p>You keep your position and return next week.</p>}
        {request.status === 'declined' && <p>Coverage has not been arranged. You remain in the draw; contact your organizer if you still cannot attend.</p>}
        {request.note && <p className="whitespace-pre-wrap break-words text-muted-foreground">Your note: {request.note}</p>}
        {request.resolution_note && <div className="rounded-xl bg-muted/50 p-3"><p className="font-semibold">From your organizer</p><p className="mt-1 whitespace-pre-wrap break-words">{request.resolution_note}</p></div>}
        {request.status === 'pending' && !generated.has(request.week_number) && <Button variant="outline" className="h-11 rounded-xl" disabled={busy} onClick={() => void mutate(request.id)}>Cancel request</Button>}
        {['sub', 'sitout'].includes(request.status) && <p className="text-muted-foreground">Plans changed? Contact your organizer so they can update the arrangement.</p>}
      </li>;
    })}</ul>}
    {!available.length && !shown.length && <p className="text-sm text-muted-foreground">{canRequest ? 'No upcoming weeks are open for requests yet. Requests open for published weeks from Week 2, before the draw.' : 'Sub requests are available to active season players while the league and season are active.'}</p>}
    {!!locked.length && <p className="text-sm text-muted-foreground">Week{locked.length > 1 ? 's' : ''} {locked.map(w => w.week_number).join(', ')} already drawn. For a late absence, contact your organizer; they can swap a substitute into unplayed games.</p>}
    {error && !open && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Dialog open={open} onOpenChange={value => { if (!busy) setOpen(value); }}>
      <FormShell icon={<CalendarClock className="h-5 w-5" />} kicker="My availability" title="Request a substitute" subtitle="This is a request, not confirmed coverage. Your organizer will assign a fill-in, arrange a sit-out, or contact you about the next step."
        primaryLabel="Send request" primaryLoading={busy} primaryDisabled={!available.some(w => w.id === pickWeek) || query.isFetching} onPrimary={() => void mutate()}
        secondary={<Button variant="outline" className="h-12 rounded-xl" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>}>
        <FormRow label="Which week can’t you attend?"><div className="max-h-56 space-y-2 overflow-y-auto">{available.map(week => <button key={week.id} type="button" aria-pressed={pickWeek === week.id} onClick={() => setPickWeek(week.id)} className={`min-h-11 w-full rounded-xl border p-3 text-left text-sm ${pickWeek === week.id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'}`}><span className="block font-semibold">{weekDescription(week)}</span>{week.location && <span className="mt-1 block text-muted-foreground break-words">{week.location}</span>}</button>)}</div></FormRow>
        <FormRow label="Note to your organizer (optional)"><Textarea value={note} maxLength={1000} onChange={e => setNote(e.target.value)} placeholder="Anything your organizer should know?" rows={3} /></FormRow>
        <p className="text-sm text-muted-foreground">You can cancel while the request is pending. Once coverage is arranged, contact the organizer to change it.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </FormShell>
    </Dialog>
  </section>;
}
