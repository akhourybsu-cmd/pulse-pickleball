import { useState } from 'react';
import { ArrowRight, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { useLeagueActions } from '@/hooks/useLeagueActions';
import { leagueErrorMessage } from '@/lib/leagues/data';
import { resolvePlayerName } from '@/lib/matchDisplay';
import type { SubRequest } from '@/lib/leagues/subRequests';
import type { ManageTab } from './leagueManageTabs';
import { ReviewSubRequestDialog } from './SubRequestInbox';
import { EmptyState, TabSkeleton } from './_shared';

export function ActionsTab({ query, onNavigate, onMutated, onReview }: {
  query: ReturnType<typeof useLeagueActions>;
  onNavigate: (tab: ManageTab, seasonId?: string) => void; onMutated: () => void;
  onReview?: (request: SubRequest) => void;
}) {
  const [review, setReview] = useState<SubRequest | null>(null);
  if (query.isPending) return <TabSkeleton lines={3} />;
  if (query.error) return <EmptyState title="Couldn't check pending actions" desc={leagueErrorMessage(query.error)} action={{ label: 'Retry actions', onClick: () => void query.refetch() }} />;
  const data = query.data;
  const nameOf = (id: string) => data.profiles[id] ? resolvePlayerName(data.profiles[id]) : 'Player';
  return <div className="space-y-4">
    <section className="lg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="text-xl font-semibold">Needs attention</h2><p className="mt-1 text-sm text-muted-foreground">Across every season. Resolve player requests and keep results moving.</p></div>
        <Button variant="outline" className="h-11 rounded-xl" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>
      {!data.seasons.length ? <div className="mt-4 space-y-3"><p className="text-sm">Start with a season, then add your players and schedule play.</p><Button className="h-11 rounded-xl" onClick={() => onNavigate('seasons')}>Set up your first season<ArrowRight className="h-4 w-4" /></Button></div> : !data.total ? <div className="mt-5 flex gap-3 rounded-xl bg-muted/50 p-4"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" /><div><p className="font-semibold">You’re all caught up</p><p className="text-sm text-muted-foreground">No pending substitute requests, season player approvals, disputes or submitted scores.</p></div></div> : <p role="status" className="mt-4 text-sm font-semibold">{data.total} item{data.total === 1 ? '' : 's'} to review</p>}
    </section>
    {!!data.requests.length && <section className="lg-card p-4 sm:p-5"><h3 className="mb-1 text-base font-semibold">Substitute requests · {data.requests.length}</h3><p className="mb-3 text-sm text-muted-foreground">Oldest first. Resolve these before drawing the requested week.</p><ul className="divide-y divide-border">
      {data.requests.map(request => <li key={request.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="break-words font-semibold">{nameOf(request.player_id)}</p><p className="mt-1 text-sm text-muted-foreground">{data.seasons.find(s => s.id === request.season_id)?.name ?? 'Season'} · Week {request.week_number}</p>{request.note && <p className="mt-2 line-clamp-2 whitespace-pre-wrap break-words text-sm">{request.note}</p>}</div>
        <Button className="h-11 shrink-0 rounded-xl" onClick={() => onReview ? onReview(request) : setReview(request)}>Review request<ArrowRight className="h-4 w-4" /></Button>
      </li>)}
    </ul></section>}
    {data.seasons.map(season => {
      const items = [
        { label: 'Score disputes', hint: 'Review the reported issue and confirm the correct result.', count: data.disputes.filter(m => m.season_id === season.id).length, tab: 'matches' as ManageTab },
        { label: 'Submitted scores', hint: 'Awaiting confirmation. Review results if players need help.', count: data.scores.filter(m => m.season_id === season.id).length, tab: 'matches' as ManageTab },
        { label: 'Player approvals', hint: 'Review pending players and activate their season membership.', count: data.members.filter(m => m.season_id === season.id).length, tab: 'members' as ManageTab },
      ].filter(item => item.count);
      return items.length ? <section key={season.id} className="lg-card p-4 sm:p-5"><h3 className="mb-2 text-base font-semibold break-words">{season.name}</h3><ul className="divide-y divide-border">{items.map(item => <li key={item.label} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="font-semibold">{item.label} · {item.count}</p><p className="text-sm text-muted-foreground">{item.hint}</p></div><Button variant="outline" className="h-11 rounded-xl" onClick={() => onNavigate(item.tab, season.id)}>Review {item.label.toLowerCase()}<ArrowRight className="h-4 w-4" /></Button></li>)}</ul></section> : null;
    })}
    {review && <ReviewSubRequestDialog request={review} playerName={nameOf(review.player_id)} onClose={() => setReview(null)} onMutated={onMutated} />}
  </div>;
}
