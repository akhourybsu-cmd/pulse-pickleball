import { LeagueMatchSide } from './LeaguePlayerName';
import type { LeagueMatch, LeagueMatchSubstitution } from '@/lib/leagues/types';
import { cn } from '@/lib/utils';

/** Names get the available width; each score remains aligned with its own side. */
export function LeagueScorecard({ match, nameOf, substitutions = [], teamAName, teamBName }: {
  match: LeagueMatch;
  nameOf: (id: string) => string;
  substitutions?: LeagueMatchSubstitution[];
  teamAName?: string | null;
  teamBName?: string | null;
}) {
  const scored = match.team_a_score !== null && match.team_b_score !== null;
  return <div className="divide-y divide-border/60 px-4">
    {[
      { key: 'a', ids: [match.player_a_id, match.player_b_id], teamName: teamAName, score: match.team_a_score, other: match.team_b_score },
      { key: 'b', ids: [match.player_c_id, match.player_d_id], teamName: teamBName, score: match.team_b_score, other: match.team_a_score },
    ].map(side => {
      const ahead = scored && side.score! > side.other!;
      return <div key={side.key} className="grid min-h-16 grid-cols-[minmax(0,1fr)_3rem] items-center gap-4 py-3">
        <div className={cn('min-w-0 text-sm leading-relaxed', ahead ? 'font-semibold text-[color:var(--lg-accent-gold)]' : 'font-medium text-[color:var(--lg-text)]')}>
          <LeagueMatchSide match={match} ids={side.ids} nameOf={nameOf} substitutions={substitutions} teamName={side.teamName} />
        </div>
        <span className={cn('lg-num rounded-lg py-2 text-center text-xl', ahead ? 'bg-primary/10 text-[color:var(--lg-accent-gold)]' : 'bg-muted/50 text-muted-foreground')}>
          {scored ? <><span className="sr-only">Score </span>{side.score}</> : <><span aria-hidden>—</span><span className="sr-only">Not scored</span></>}
        </span>
      </div>;
    })}
  </div>;
}
