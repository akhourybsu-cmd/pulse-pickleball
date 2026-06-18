import { useEffect, useState } from 'react';
import { Check, Clock, AlertCircle, RotateCcw, BarChart3 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface GroupInviteAnalyticsProps {
  groupId: string;
}

interface Summary {
  joined: number;
  pending: number;
  duplicate: number;
  failed: number;
  total: number;
  last_used: string | null;
}

interface RecentUse {
  id: string;
  invite_code: string;
  outcome: 'joined' | 'pending' | 'duplicate' | 'failed';
  used_at: string;
  user_id: string;
  user_name: string | null;
}

/**
 * Admin-only invite analytics. Shows aggregate counts (joined / pending /
 * already-member / failed) plus the most recent attempts so the
 * organizer can answer the obvious question — "did the link I texted
 * Sarah work?" — at a glance.
 */
export function GroupInviteAnalytics({ groupId }: GroupInviteAnalyticsProps) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [recent, setRecent] = useState<RecentUse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const [{ data: sumData }, { data: rowsData }] = await Promise.all([
        supabase.rpc('group_invite_summary' as any, { p_group_id: groupId }),
        supabase
          .from('group_invite_uses' as any)
          .select('id, invite_code, outcome, used_at, user_id')
          .eq('group_id', groupId)
          .order('used_at', { ascending: false })
          .limit(10),
      ]);

      if (cancelled) return;

      // RPC returns a one-row array (RETURNS TABLE).
      const row = Array.isArray(sumData) ? (sumData[0] as any) : (sumData as any);
      setSummary(row ?? null);

      // Hydrate display names for the recent list. One query keeps it
      // efficient regardless of the recent list size.
      const ids = Array.from(new Set((rowsData ?? []).map((r: any) => r.user_id)));
      const nameMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, display_name, full_name')
          .in('id', ids);
        (profs ?? []).forEach((p: any) => {
          nameMap.set(p.id, p.display_name || p.full_name || 'Someone');
        });
      }

      setRecent(
        (rowsData ?? []).map((r: any) => ({
          ...r,
          user_name: nameMap.get(r.user_id) ?? null,
        }))
      );
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [groupId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const counts = summary ?? { joined: 0, pending: 0, duplicate: 0, failed: 0, total: 0, last_used: null };

  // Most useful 4 numbers at a glance.
  const stats: { key: keyof Summary; label: string; icon: typeof Check; tone: string }[] = [
    { key: 'joined',    label: 'Joined',          icon: Check,        tone: 'text-primary bg-primary/10' },
    { key: 'pending',   label: 'Pending',         icon: Clock,        tone: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
    { key: 'duplicate', label: 'Already member',  icon: RotateCcw,    tone: 'text-muted-foreground bg-muted' },
    { key: 'failed',    label: 'Failed',          icon: AlertCircle,  tone: 'text-destructive bg-destructive/10' },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Invite activity</h3>
        {counts.last_used && (
          <span className="text-[11px] text-muted-foreground ml-auto">
            Last used {formatDistanceToNow(new Date(counts.last_used), { addSuffix: true })}
          </span>
        )}
      </div>

      {counts.total === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center">
          <p className="text-sm font-medium">No invite uses yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Numbers show up here as soon as someone tries your code.
          </p>
        </div>
      ) : (
        <>
          {/* Stat tiles */}
          <div className="grid grid-cols-4 gap-2">
            {stats.map(({ key, label, icon: Icon, tone }) => (
              <div
                key={key}
                className="rounded-lg border border-border/60 px-2 py-2.5 text-center"
              >
                <div className={cn('mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full', tone)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="text-base font-bold tabular-nums leading-none">
                  {(counts as any)[key]}
                </div>
                <div className="text-[10px] text-muted-foreground mt-1 leading-tight">
                  {label}
                </div>
              </div>
            ))}
          </div>

          {/* Recent attempts */}
          {recent.length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Recent
              </h4>
              <div className="rounded-lg border border-border/60 divide-y divide-border/40 overflow-hidden">
                {recent.map((r) => {
                  const meta =
                    r.outcome === 'joined'    ? { Icon: Check, tone: 'text-primary' } :
                    r.outcome === 'pending'   ? { Icon: Clock, tone: 'text-amber-600 dark:text-amber-400' } :
                    r.outcome === 'duplicate' ? { Icon: RotateCcw, tone: 'text-muted-foreground' } :
                                                { Icon: AlertCircle, tone: 'text-destructive' };
                  const Icon = meta.Icon;
                  return (
                    <div key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', meta.tone)} />
                      <div className="flex-1 min-w-0 truncate">
                        <span className="font-medium">{r.user_name ?? 'Someone'}</span>
                        <span className="text-muted-foreground"> · {r.outcome}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
                        {formatDistanceToNow(new Date(r.used_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
