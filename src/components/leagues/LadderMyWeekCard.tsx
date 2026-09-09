import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { leagueRows, leagueProfiles } from '@/lib/leagues/data';
import { courtPlayerIds, matchPlayerIds, leaguePlayerName, substitutePlayerIds, matchSubstitutions } from '@/lib/leagues/playerIdentity';
import { LeaguePlayerName } from './LeaguePlayerName';
import type { LeagueMatch, LeagueMatchSubstitution } from '@/lib/leagues/types';
import { LgSectionHeader } from "@/components/leagues/_leagueScope";
import { Layers, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface Snapshot { player_ids: string[] }
interface BatchRow {
  id: string;
  week_number: number;
  batch_number: number;
  status: string;
}
interface GroupRow {
  id: string;
  court_number: number | null;
  wave: number;
  player_ids: string[];
}
interface MovementRow {
  player_id: string;
  direction: "up" | "stay" | "down";
  start_position: number;
  finish_position: number;
}

/**
 * "This week" orientation card for a ladder player.
 *
 * A ladder player's two most-asked questions are "where am I on the ladder?"
 * and "which court am I on and who with?". Both were previously only
 * inferable by scanning individual match rows or hunting the standings table,
 * so this pins them at the top of the player league page.
 */
export function LadderMyWeekCard({
  seasonId, currentUserId, dataVersion,
}: {
  seasonId: string | null;
  currentUserId: string | null;
  dataVersion?: number;
}) {
  const query = useQuery({
    queryKey: ['ladder-my-week', currentUserId, seasonId],
    enabled: !!seasonId && !!currentUserId,
    refetchInterval: 60_000,
    queryFn: async ({ signal }) => {
      const [snapshots, batches, matches, substitutions] = await Promise.all([
        leagueRows<Snapshot & { id: string; week_number: number; batch_number: number }>('ladder_snapshots', { season_id: seasonId! }, signal),
        leagueRows<BatchRow>('ladder_batches', { season_id: seasonId! }, signal),
        leagueRows<LeagueMatch>('league_matches', { season_id: seasonId! }, signal),
        leagueRows<LeagueMatchSubstitution>('league_match_substitutions', { season_id: seasonId! }, signal),
      ]);
      const order = snapshots.sort((a,b) => b.week_number-a.week_number || b.batch_number-a.batch_number)[0]?.player_ids ?? [];
      const position = order.includes(currentUserId!) ? order.indexOf(currentUserId!) + 1 : null;
      const live = batches.sort((a,b) => a.week_number-b.week_number || a.batch_number-b.batch_number)
        .find(b => b.status !== 'finalized' && b.status !== 'invalidated') ?? null;
      const groups = live ? await leagueRows<GroupRow>('ladder_batch_groups', { batch_id: live.id }, signal) : [];
      // A group's stored IDs are the regular ladder seats. Locate a fill-in by
      // their actual match slots; do not hide their court because they have no seat.
      const group = groups.find(g => matches.some(m => m.ladder_batch_group_id === g.id
        && matchPlayerIds(m).includes(currentUserId!))) ?? groups.find(g => g.player_ids.includes(currentUserId!)) ?? null;
      const games = matches.filter(m => m.ladder_batch_group_id === group?.id && m.status !== 'canceled');
      const participants = group ? courtPlayerIds(group.player_ids, games) : [];
      const profiles = await leagueProfiles(participants, signal);
      const lastFinal = [...batches].reverse().find(b => b.status === 'finalized');
      const movements = lastFinal ? await leagueRows<MovementRow & { id: string }>('ladder_movements', { batch_id: lastFinal.id, player_id: currentUserId! }, signal) : [];
      return { position, ladderSize: order.length, batch: live, group, participants,
        coveringForMe: [...new Set(games.flatMap(m => matchSubstitutions(m, substitutions)).filter(s => s.out_player_id === currentUserId).map(s => s.in_player_id))],
        names: Object.fromEntries(profiles.map(p => [p.id, leaguePlayerName(p)])),
        subIds: substitutePlayerIds(games, substitutions), movement: movements[0] ?? null };
    },
  });
  useEffect(() => { if (dataVersion) void query.refetch(); }, [dataVersion, query.refetch]);
  if (query.isPending || !seasonId || !currentUserId) return null;
  if (query.error) return <div className="lg-card p-4 text-sm" role="alert">Your court could not be loaded. <button className="min-h-11 underline" onClick={() => void query.refetch()}>Retry court</button></div>;
  const { position, ladderSize, batch, group, participants, names, subIds, movement, coveringForMe } = query.data;
  if (!position && !group) return null;

  const MoveIcon = movement?.direction === "up"
    ? ArrowUp
    : movement?.direction === "down" ? ArrowDown : Minus;
  const moveTone = movement?.direction === "up"
    ? "text-[color:var(--lg-emerald-bright)]"
    : movement?.direction === "down"
      ? "text-destructive"
      : "text-[color:var(--lg-text-dim)]";

  return (
    <div className="lg-card p-4 space-y-3">
      <LgSectionHeader icon={Layers} className="mb-0">
        {batch ? `This week · Week ${batch.week_number}` : "Your ladder spot"}
      </LgSectionHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[color:var(--lg-border)] bg-[color:var(--lg-surface-2)] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)]">
            Ladder position
          </div>
          <div className="text-2xl font-black tabular-nums text-[color:var(--lg-text)] flex items-baseline gap-1.5">
            {position ?? (currentUserId && subIds.has(currentUserId) ? 'Sub' : '—')}
            {ladderSize > 0 && position && (
              <span className="text-xs font-semibold text-[color:var(--lg-text-dim)]">
                of {ladderSize}
              </span>
            )}
          </div>
          {movement && (
            <div className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${moveTone}`}>
              <MoveIcon className="w-3 h-3" />
              {movement.direction === "stay"
                ? "Held your spot last round"
                : `${movement.direction === "up" ? "Up" : "Down"} from ${movement.start_position}`}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[color:var(--lg-border)] bg-[color:var(--lg-surface-2)] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)]">
            Your court
          </div>
          <div className="text-2xl font-black tabular-nums text-[color:var(--lg-text)]">
            {group?.court_number ?? "—"}
          </div>
          {group && group.wave > 1 && (
            <div className="mt-0.5 text-[11px] text-[color:var(--lg-text-dim)]">
              Wave {group.wave}
            </div>
          )}
        </div>
      </div>

      {group ? (
        <div>
          {!!coveringForMe.length && <p className="mb-3 text-sm">Covering your games: {coveringForMe.map(id => <LeaguePlayerName key={id} name={names[id] ?? 'Name unavailable'} isSub />)}. Your ladder position is retained.</p>}
          <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)] mb-1.5">
            Your foursome — you rotate partners across three games
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {participants.map((pid) => (
              <li
                key={pid}
                className={
                  pid === currentUserId
                    ? "rounded-full px-2.5 py-1 text-xs font-bold bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-accent-gold)] ring-1 ring-[color:var(--lg-gold)]/40"
                    : "rounded-full px-2.5 py-1 text-xs font-medium bg-[color:var(--lg-surface-2)] text-[color:var(--lg-text)] border border-[color:var(--lg-border)]"
                }
              >
                <LeaguePlayerName name={names[pid] ?? 'Name unavailable'} isSub={subIds.has(pid)} />{pid === currentUserId && ' · you'}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-[color:var(--lg-text-dim)]">
          The next round hasn't been drawn yet — your court and foursome appear
          here as soon as the organizer generates it.
        </p>
      )}
    </div>
  );
}
