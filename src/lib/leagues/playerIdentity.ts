import { resolvePlayerName, type MinimalProfile } from '@/lib/matchDisplay';
import type { LeagueMatchSubstitution } from './types';

const opaqueId = /^(?:[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}|[0-9a-f]{8}|\d{6,})$/i;
/** A database identifier is never a person's display name. */
export function leaguePlayerName(profile?: MinimalProfile | null): string {
  const clean = (value?: string | null) => value?.trim() && !opaqueId.test(value.trim()) ? value.trim() : null;
  const safe = { display_name: clean(profile?.display_name), full_name: clean(profile?.full_name),
    first_name: clean(profile?.first_name), last_name: clean(profile?.last_name) };
  return Object.values(safe).some(Boolean) ? resolvePlayerName(safe) : 'Name unavailable';
}

export type PlayerSlots = { id: string; player_a_id: string | null; player_b_id: string | null; player_c_id: string | null; player_d_id: string | null };
export const playerSlots = ['a', 'b', 'c', 'd'] as const;
export function matchPlayerIds(match: PlayerSlots) {
  return playerSlots.map(slot => match[`player_${slot}_id`]).filter((id): id is string => !!id);
}
/** Match-scoped evidence, not bench membership: a regular can also fill in.
 * Ignore stale substitution rows after a slot has been restored or changed. */
export function matchSubstitutions(match: PlayerSlots, rows: LeagueMatchSubstitution[]) {
  return rows.filter(row => row.match_id === match.id && row.in_player_id !== row.out_player_id
    && playerSlots.includes(row.slot) && match[`player_${row.slot}_id`] === row.in_player_id);
}
export function substitutePlayerIds(matches: PlayerSlots[], rows: LeagueMatchSubstitution[]) {
  return new Set(matches.flatMap(match => matchSubstitutions(match, rows).map(row => row.in_player_id)));
}
/** Plain-text equivalent for selects, score confirmations and announcements. */
export function matchPlayerLabel(match: PlayerSlots | null, id: string, name: string, rows: LeagueMatchSubstitution[]) {
  return `${name}${match && matchSubstitutions(match, rows).some(s => s.in_player_id === id) ? ' (Sub)' : ''}`;
}
/** Groups store ladder seats, while match slots store who actually plays.
 * Include both people on a partial swap; never rewrite the regular's ladder seat. */
export function courtPlayerIds(seats: string[], games: PlayerSlots[]) {
  return [...new Set(games.length ? games.flatMap(matchPlayerIds) : seats)];
}

export function substitutionTargets(matches: (PlayerSlots & { status: string; ladder_batch_group_id: string | null })[],
  batches: Record<string, { batch_id: string; week_number: number; batch_number: number }>, incomingId: string) {
  const open = matches.filter(m => ['scheduled', 'in_progress'].includes(m.status));
  return [...new Set(open.flatMap(matchPlayerIds))].filter(id => id !== incomingId).map(id => {
    const games = open.filter(m => matchPlayerIds(m).includes(id));
    const missingBatch = games.some(m => m.ladder_batch_group_id && !batches[m.ladder_batch_group_id]);
    const batch = games.flatMap(m => m.ladder_batch_group_id && batches[m.ladder_batch_group_id] ? [batches[m.ladder_batch_group_id]] : [])
      .sort((a,b) => a.week_number-b.week_number || a.batch_number-b.batch_number)[0];
    const scoped = batch ? open.filter(m => m.ladder_batch_group_id && batches[m.ladder_batch_group_id]?.batch_id === batch.batch_id) : open;
    return { id, batchId: batch?.batch_id ?? null, count: scoped.filter(m => matchPlayerIds(m).includes(id)).length,
      scopeLabel: batch ? `Week ${batch.week_number} · Batch ${batch.batch_number}` : 'All unplayed games in this season',
      blockedReason: missingBatch ? 'Batch details are unavailable. Refresh before swapping.'
        : scoped.some(m => matchPlayerIds(m).includes(incomingId)) ? 'This substitute is already playing in this batch or schedule.' : null };
  });
}
