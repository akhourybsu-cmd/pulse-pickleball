import { useId } from 'react';
import { Trophy, Flag } from 'lucide-react';
import type { StandingRow, FormResult } from '@/lib/leagues/standings';
import { cn } from '@/lib/utils';
import { LeaguePlayerName } from './LeaguePlayerName';

/** Presentation only. Keep the caller's ordering, rankings, and computed results. */
export function StandingsTable({
  rows, highlightTeamIds, emptyMessage = 'No results yet.', nameHeader = 'Team', substituteIds,
}: {
  rows: StandingRow[];
  highlightTeamIds?: Set<string>;
  emptyMessage?: string;
  nameHeader?: string;
  substituteIds?: Set<string>;
}) {
  const legendId = useId();
  if (!rows.length) return <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
    <Trophy className="mx-auto mb-3 h-6 w-6 text-[color:var(--lg-accent-gold)]" aria-hidden />
    <p className="text-sm leading-relaxed text-muted-foreground">{emptyMessage}</p>
  </div>;

  return <div className="lg-standings overflow-hidden rounded-xl border border-border/70 bg-card">
    <table className="lg-standings-table text-sm tabular-nums" aria-describedby={legendId}>
      <caption className="sr-only">{nameHeader} standings, ordered by rank</caption>
      <thead><tr>
        <th scope="col" className="lg-rank-col"><span aria-hidden>#</span><span className="sr-only">Rank</span></th>
        <th scope="col" className="lg-name-col">{nameHeader}</th>
        <th scope="col" className="lg-record-col"><abbr title="Wins" className="no-underline">W</abbr></th>
        <th scope="col" className="lg-record-col"><abbr title="Losses" className="no-underline">L</abbr></th>
        <th scope="col" className="lg-extra-col"><abbr title="Games played" className="no-underline">GP</abbr></th>
        <th scope="col" className="lg-diff-col"><abbr title="Point difference" className="no-underline">±</abbr></th>
        <th scope="col" className="lg-extra-col lg-percent-col"><abbr title="Win percentage" className="whitespace-nowrap no-underline">Win%</abbr></th>
        <th scope="col" className="lg-extra-col lg-form-col">Last 5</th>
      </tr></thead>
      <tbody>{rows.map((row, i) => {
        const highlighted = highlightTeamIds?.has(row.teamId) ?? false;
        const forfeits = row.forfeitWins + row.forfeitLosses;
        return <tr key={row.teamId} data-highlighted={highlighted}>
          <td className="lg-rank-col"><RankBadge rank={i + 1} /></td>
          <th scope="row" className="lg-name-col">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
              <LeaguePlayerName name={row.teamName} isSub={substituteIds?.has(row.teamId)} className={cn('min-w-0 break-words text-left font-medium leading-relaxed', highlighted && 'font-bold text-[color:var(--lg-accent-gold)]')} />
              {highlighted && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-[color:var(--lg-accent-gold)]">{nameHeader === 'Player' ? 'You' : 'Your team'}</span>}
              {forfeits > 0 && <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-700 dark:text-amber-300" aria-label={`${row.forfeitWins} forfeit wins, ${row.forfeitLosses} forfeit losses`} title={`${row.forfeitWins} forfeit wins, ${row.forfeitLosses} forfeit losses`}><Flag className="h-3 w-3" aria-hidden />{forfeits}</span>}
            </div>
          </th>
          <td className="lg-record-col font-semibold">{row.wins}</td>
          <td className="lg-record-col text-muted-foreground">{row.losses}</td>
          <td className="lg-extra-col text-muted-foreground">{row.gamesPlayed}</td>
          <td className={cn('lg-diff-col font-medium', row.pointDiff > 0 ? 'text-emerald-700 dark:text-emerald-300' : row.pointDiff < 0 ? 'text-destructive' : 'text-muted-foreground')}>{row.pointDiff > 0 ? '+' : ''}{row.pointDiff}</td>
          <td className="lg-extra-col lg-percent-col text-xs text-muted-foreground">{(row.winPct * 100).toFixed(0)}%</td>
          <td className="lg-extra-col lg-form-col"><FormChips form={row.recentForm} /></td>
        </tr>;
      })}</tbody>
    </table>
    <div id={legendId} className="space-y-1 border-t border-border/70 bg-muted/20 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
      <p>W · Wins <span aria-hidden className="px-1">/</span> L · Losses <span aria-hidden className="px-1">/</span> ± · Point difference</p>
      {rows.some(row => substituteIds?.has(row.teamId)) && <p>Sub marks players with substitute appearances in these results. Wins and points belong to the person who played.</p>}
    </div>
  </div>;
}

const FORM_LABELS: Record<FormResult, string> = { W: 'Win', L: 'Loss', FW: 'Won by forfeit', FL: 'Lost by forfeit' };
function FormChips({ form }: { form: FormResult[] }) {
  const recent = form.slice(-5);
  const padded: (FormResult | null)[] = [...Array<null>(Math.max(0, 5 - recent.length)).fill(null), ...recent];
  return <div className="flex justify-end gap-1" aria-label={recent.length ? `Recent form, oldest to newest: ${recent.map(r => FORM_LABELS[r]).join(', ')}` : 'No results yet'}>
    {padded.map((r, i) => <span key={i} aria-hidden title={r ? FORM_LABELS[r] : 'No result yet'} className={cn(
      'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold',
      r === 'W' && 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
      r === 'L' && 'bg-destructive/10 text-destructive',
      (r === 'FW' || r === 'FL') && 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
      r === null && 'bg-muted text-muted-foreground',
    )}>{r === null ? '·' : r === 'FW' || r === 'FL' ? 'F' : r}</span>)}
  </div>;
}

function RankBadge({ rank }: { rank: number }) {
  return <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold',
    rank === 1 ? 'bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-accent-gold)] ring-1 ring-[color:var(--lg-gold)]/30' :
    rank === 2 ? 'bg-muted text-foreground ring-1 ring-border' :
    rank === 3 ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'text-muted-foreground',
  )}>{rank}</span>;
}
