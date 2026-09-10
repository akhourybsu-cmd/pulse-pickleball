import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuthState } from '@/hooks/useAuthState';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Crown, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/getErrorMessage';
import { VenueLoadState } from '@/components/venue/VenueLoadState';
import { fetchVenueCourts, refreshVenueSettings, removeVenueCourt, updateVenueCourt, type VenueCourtSettings } from '@/lib/venues/settings';

const SURFACES = ['Indoor', 'Outdoor', 'Hard court', 'Cushioned', 'Gym floor'];

export function VenueCourtsSection({ venueId }: { venueId: string }) {
  const { toast } = useToast();
  const { user } = useAuthState();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['venue-courts-settings', venueId, user?.id],
    queryFn: () => fetchVenueCourts(venueId), enabled: !!user,
  });
  const courts = query.data ?? [];
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [surface, setSurface] = useState(SURFACES[0]);
  const [premium, setPremium] = useState(false);
  const [edit, setEdit] = useState<VenueCourtSettings | null>(null);
  const [removeTarget, setRemoveTarget] = useState<VenueCourtSettings | null>(null);
  const nextNumber = courts.reduce((max, court) => Math.max(max, court.court_number ?? 0), 0) + 1;

  const run = async (action: () => Promise<void>, title: string) => {
    if (lock.current || query.isPending || query.isError) return false;
    lock.current = true; setBusy(true); setError(null);
    try {
      await action();
      await refreshVenueSettings(queryClient, venueId);
      toast({ title });
      return true;
    } catch (cause) {
      setError(getErrorMessage(cause, 'Your court changes could not be saved. Try again.'));
      return false;
    } finally { lock.current = false; setBusy(false); }
  };

  const addCourt = async () => {
    const success = await run(async () => {
      const { data, error } = await supabase.from('venue_courts').insert({
        venue_id: venueId, court_number: nextNumber, name: name.trim() || `Court ${nextNumber}`,
        surface_type: surface, is_active: true, is_premium: premium,
      }).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('The court was not added. Reload and try again.');
    }, 'Court added');
    if (success) { setName(''); setPremium(false); }
  };

  if (query.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (query.isError) return <VenueLoadState title="Courts couldn’t load" description="Load your court list before making changes." onRetry={() => void query.refetch()} />;

  return <>
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="font-sans text-base">Courts</CardTitle>
        <CardDescription>Manage court names, surfaces, and availability. Player reservations require the Court Booking add-on.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs leading-5 text-muted-foreground">Turn off Available to remove a court from new bookings. Existing sessions stay on its record and should be reviewed in Operations. Premium marks a court for your venue’s premium-court settings; it does not activate a paid add-on.</p>
        {error && !edit && !removeTarget && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!courts.length ? <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No courts yet. Add your first court below.</p> :
          <ul className="space-y-2">{courts.map(court => <li key={court.id} className={cn('rounded-xl border border-border/70 p-3', court.is_active === false && 'bg-muted/40')}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-semibold">{court.name || `Court ${court.court_number}`}</p>
                <p className="mt-1 text-xs text-muted-foreground">{court.surface_type || 'Surface not set'} · {court.is_active === false ? 'Unavailable' : 'Available'}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" disabled={busy} aria-label={`Edit ${court.name || 'court'}`} onClick={() => { setError(null); setEdit({ ...court }); }}><Pencil className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive" disabled={busy} aria-label={`Remove ${court.name || 'court'}`} onClick={() => { setError(null); setRemoveTarget(court); }}><Trash2 className="h-4 w-4" /></Button>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 border-t border-border/50 pt-1">
              <label className="flex min-h-11 items-center gap-2 text-xs font-medium"><Switch disabled={busy} checked={court.is_active !== false} onCheckedChange={value => void run(() => updateVenueCourt(venueId, court.id, { is_active: value }), 'Court availability updated')} aria-label={`${court.name || 'Court'} available`} />Available</label>
              <label className="flex min-h-11 items-center gap-2 text-xs font-medium"><Switch disabled={busy} checked={court.is_premium === true} onCheckedChange={value => void run(() => updateVenueCourt(venueId, court.id, { is_premium: value }), 'Court updated')} aria-label={`${court.name || 'Court'} premium`} /><Crown className="h-3.5 w-3.5 text-amber-500" />Premium</label>
            </div>
          </li>)}</ul>}
        <fieldset disabled={busy} className="grid min-w-0 gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 p-3 md:grid-cols-2">
          <div className="min-w-0 space-y-2"><Label htmlFor="court-name">Court name</Label><Input id="court-name" className="h-11" placeholder={`Court ${nextNumber}`} value={name} onChange={e => setName(e.target.value)} maxLength={40} /></div>
          <div className="min-w-0 space-y-2"><Label htmlFor="court-surface">Surface</Label><SurfaceSelect id="court-surface" value={surface} onChange={setSurface} disabled={busy} /></div>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium"><Switch disabled={busy} checked={premium} onCheckedChange={setPremium} aria-label="New court premium" /><Crown className="h-4 w-4 text-amber-500" />Premium court</label>
          <Button onClick={() => void addCourt()} disabled={busy} className="min-h-11">{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}Add court</Button>
        </fieldset>
      </CardContent>
    </Card>
    <Dialog open={!!edit} onOpenChange={open => { if (!open && !busy) { setEdit(null); setError(null); } }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl sm:max-w-md">
        <DialogHeader><DialogTitle className="font-sans">Edit court</DialogTitle><DialogDescription>Keep the same court and booking history while updating its details.</DialogDescription></DialogHeader>
        {edit && <fieldset disabled={busy} className="min-w-0 space-y-4">
          <div className="space-y-2"><Label htmlFor="edit-court-name">Court name</Label><Input id="edit-court-name" className="h-11" maxLength={40} value={edit.name ?? ''} onChange={e => setEdit({ ...edit, name: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="edit-court-surface">Surface</Label><SurfaceSelect id="edit-court-surface" value={edit.surface_type ?? SURFACES[0]} onChange={value => setEdit({ ...edit, surface_type: value })} disabled={busy} /></div>
        </fieldset>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <DialogFooter className="gap-2"><Button className="min-h-11" variant="outline" disabled={busy} onClick={() => { setEdit(null); setError(null); }}>Cancel</Button><Button className="min-h-11" disabled={busy || !edit?.name?.trim()} onClick={async () => {
          if (edit && await run(() => updateVenueCourt(venueId, edit.id, { name: edit.name!.trim(), surface_type: edit.surface_type ?? SURFACES[0] }), 'Court details updated')) setEdit(null);
        }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    <AlertDialog open={!!removeTarget} onOpenChange={open => { if (!open && !busy) { setRemoveTarget(null); setError(null); } }}>
      <AlertDialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl">
        <AlertDialogHeader><AlertDialogTitle className="font-sans">Remove {removeTarget?.name || 'this court'}?</AlertDialogTitle><AlertDialogDescription>Only courts without scheduled activity or booking history can be removed. For a temporary closure, cancel and turn off Available instead. Removing a court cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter><AlertDialogCancel className="min-h-11" disabled={busy}>Keep court</AlertDialogCancel><AlertDialogAction className="min-h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy} onClick={async event => {
          event.preventDefault();
          if (removeTarget && await run(() => removeVenueCourt(venueId, removeTarget.id), 'Court removed')) setRemoveTarget(null);
        }}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove court</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

function SurfaceSelect({ id, value, onChange, disabled }: { id: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const options = SURFACES.includes(value) ? SURFACES : [...SURFACES, value];
  return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger id={id} className="h-11"><SelectValue /></SelectTrigger><SelectContent>{options.map(surface => <SelectItem key={surface} value={surface}>{surface}</SelectItem>)}</SelectContent></Select>;
}
