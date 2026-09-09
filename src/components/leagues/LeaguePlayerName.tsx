import { Fragment } from 'react';
import { cn } from '@/lib/utils';
import { matchSubstitutions, type PlayerSlots } from '@/lib/leagues/playerIdentity';
import type { LeagueMatchSubstitution } from '@/lib/leagues/types';

/** Text + an explicit badge keeps substitute status legible without relying on color. */
export function LeaguePlayerName({ name, isSub = false, replacesName, className }: {
  name: string; isSub?: boolean; replacesName?: string; className?: string;
}) {
  return <span className={cn('min-w-0 break-words', className)}>
    <span className={isSub ? 'italic' : undefined}>{name}</span>
    {isSub && <> <span className="inline-block whitespace-nowrap rounded border border-current/20 px-1.5 py-0.5 align-baseline text-xs font-semibold not-italic leading-none" title={replacesName ? `Substitute for ${replacesName}` : 'Substitute'}>Sub</span></>}
    {replacesName && <span className="block text-xs font-normal not-italic text-muted-foreground">For {replacesName}</span>}
  </span>;
}

export function LeagueMatchSide({ match, ids, nameOf, substitutions = [], teamName }: {
  match: PlayerSlots; ids: (string | null)[]; nameOf: (id: string) => string;
  substitutions?: LeagueMatchSubstitution[]; teamName?: string | null;
}) {
  const subs = matchSubstitutions(match, substitutions);
  const players = ids.filter((id): id is string => !!id);
  return <span className="block min-w-0 break-words">
    {teamName && <span className="block">{teamName}</span>}
    <span className={teamName ? 'block text-xs font-normal' : undefined}>
      {players.length ? players.map((id, index) => <Fragment key={id}>
        {index > 0 && <span className="font-normal"> &amp; </span>}
        <LeaguePlayerName name={nameOf(id)} isSub={subs.some(s => s.in_player_id === id)} />
      </Fragment>) : !teamName ? 'Players to be confirmed' : null}
    </span>
  </span>;
}
