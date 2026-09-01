import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Crown, Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The venue's courts.
 *
 * Adding the first court is what turns booking on: the venue shell only shows
 * its Book tab once courts exist, so a venue that just wants a branded
 * community never sees a reservation system it didn't ask for.
 *
 * Deactivating rather than deleting is the normal move — a court out for
 * resurfacing disappears from the grid while its history stays intact.
 */

interface VenueCourt {
  id: string;
  name: string | null;
  court_number: number | null;
  surface_type: string | null;
  is_active: boolean | null;
  is_premium: boolean | null;
}

const SURFACES = ['Indoor', 'Outdoor', 'Hard court', 'Cushioned', 'Gym floor'] as const;

export function VenueCourtsSection({ venueId }: { venueId: string }) {
  const { toast } = useToast();
  const [courts, setCourts] = useState<VenueCourt[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [surface, setSurface] = useState<string>(SURFACES[0]);
  const [premium, setPremium] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('venue_courts')
      .select('id, name, court_number, surface_type, is_active, is_premium')
      .eq('venue_id', venueId)
      .order('court_number', { ascending: true });

    if (error) {
      toast({ title: 'Error loading courts', description: error.message, variant: 'destructive' });
    } else {
      setCourts(data ?? []);
    }
    setLoading(false);
  }, [venueId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const addCourt = async () => {
    setAdding(true);
    // Next number after the highest existing one, so re-adding after a delete
    // never collides with a court number already on the fence.
    const nextNumber =
      courts.reduce((max, c) => Math.max(max, c.court_number ?? 0), 0) + 1;

    const { error } = await supabase.from('venue_courts').insert({
      venue_id: venueId,
      court_number: nextNumber,
      name: name.trim() || `Court ${nextNumber}`,
      surface_type: surface,
      is_active: true,
      is_premium: premium,
    });

    setAdding(false);

    if (error) {
      toast({ title: 'Could not add court', description: error.message, variant: 'destructive' });
      return;
    }
    setName('');
    setPremium(false);
    toast({ title: 'Court added' });
    void load();
  };

  const setActive = async (court: VenueCourt, active: boolean) => {
    const { error } = await supabase
      .from('venue_courts')
      .update({ is_active: active })
      .eq('id', court.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    setCourts((cs) => cs.map((c) => (c.id === court.id ? { ...c, is_active: active } : c)));
  };

  const setPremiumCourt = async (court: VenueCourt, nextPremium: boolean) => {
    const { error } = await supabase
      .from('venue_courts')
      .update({ is_premium: nextPremium })
      .eq('id', court.id);
    if (error) {
      toast({ title: 'Could not update court', description: error.message, variant: 'destructive' });
      return;
    }
    setCourts((rows) => rows.map((row) => row.id === court.id ? { ...row, is_premium: nextPremium } : row));
  };

  const remove = async (court: VenueCourt) => {
    // Existing bookings reference this court; the FK is ON DELETE SET NULL, so
    // they survive as sessions without a court rather than vanishing.
    const { error } = await supabase.from('venue_courts').delete().eq('id', court.id);
    if (error) {
      toast({ title: 'Could not remove court', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Court removed' });
    void load();
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Courts</CardTitle>
        <CardDescription>
          Add your courts to turn on booking. Members can then reserve them from the venue's
          Book tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : courts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No courts yet. Add one below and the Book tab appears.
          </p>
        ) : (
          <ul className="space-y-2">
            {courts.map((court) => (
              <li
                key={court.id}
                className={cn(
                  'flex flex-col gap-3 rounded-xl border border-border/70 px-3 py-3 sm:flex-row sm:items-center',
                  court.is_active === false && 'bg-muted/40',
                )}
              >
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-semibold',
                      court.is_active === false && 'text-muted-foreground',
                    )}
                  >
                    {court.name ?? `Court ${court.court_number}`}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[court.surface_type, court.is_active === false ? 'Unavailable' : null]
                      .filter(Boolean)
                      .join(' · ') || ' '}
                  </p>
                </div>

                <div className="flex w-full items-center justify-between gap-2 pl-0 sm:w-auto sm:justify-start">
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Switch
                      checked={court.is_premium === true}
                      onCheckedChange={(value) => void setPremiumCourt(court, value)}
                      aria-label={`${court.name ?? 'Court'} premium`}
                    />
                    <Crown className="h-3.5 w-3.5" /> Premium
                  </label>
                  <span className="h-5 w-px bg-border/70" />
                  <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                  <Switch
                    checked={court.is_active !== false}
                    onCheckedChange={(v) => setActive(court, v)}
                    aria-label={`${court.name ?? 'Court'} available`}
                  />
                    Available
                  </label>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => remove(court)}
                    aria-label={`Remove ${court.name ?? 'court'}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 rounded-xl border border-dashed border-border/80 bg-muted/15 p-3 lg:grid-cols-[minmax(0,1fr)_160px_auto_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="court-name">Court name</Label>
            <Input
              id="court-name"
              placeholder={`Court ${courts.reduce((m, c) => Math.max(m, c.court_number ?? 0), 0) + 1}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="court-surface">Surface</Label>
            <Select value={surface} onValueChange={setSurface}>
              <SelectTrigger id="court-surface" className="w-full lg:w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SURFACES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex h-10 items-center gap-2 text-sm font-medium lg:mb-0">
            <Switch checked={premium} onCheckedChange={setPremium} />
            <Crown className="h-4 w-4 text-amber-500" /> Premium
          </label>
          <Button onClick={addCourt} disabled={adding}>
            {adding ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add court
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
