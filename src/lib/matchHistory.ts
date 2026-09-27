import {
  didTeamWin,
  participantProfileId,
  resolveParticipantName,
  type ParticipantLike,
  type MinimalProfile,
} from "./matchDisplay";

export interface HistoryParticipant extends ParticipantLike {
  match_id: string;
  team: number;
  profiles?: (MinimalProfile & { avatar_url?: string | null }) | null;
}
export interface HistoryRow {
  match_id: string;
  team: number;
  rating_change: number | null;
  rating_after: number | null;
  matches: {
    match_date: string;
    created_at: string;
    team1_score: number;
    team2_score: number;
    status: string;
    voided: boolean | null;
    count_for_rating: boolean | null;
    other_location: string | null;
    courts: { name: string } | null;
    verified_by: string[] | null;
    source: string | null;
    round_no: number | null;
    court_no: number | null;
  };
}
export interface HistoryApproval {
  match_id: string;
  player_id: string;
  approved: boolean | null;
}
export interface HistoryMatch {
  match_id: string;
  match_date: string;
  created_at: string;
  team1_score: number;
  team2_score: number;
  my_team: 1 | 2;
  partner_name: string;
  partner_id: string;
  partner_avatar_url?: string | null;
  opponent1_name: string;
  opponent1_id: string;
  opponent1_avatar_url?: string | null;
  opponent2_name: string;
  opponent2_id: string;
  opponent2_avatar_url?: string | null;
  rating_change: number | null;
  rating_after: number | null;
  court_name: string;
  won: boolean;
  is_ranked: boolean;
  verified_by: string[];
  registered_player_ids: string[];
  approval_player_ids: string[];
  source?: string | null;
  round_no?: number | null;
  court_no?: number | null;
  rr_event_id?: string;
  rr_event_name?: string;
  rr_event_date?: string;
}
export interface RoundRobinGroup {
  eventId: string;
  name: string;
  date: string;
  matches: HistoryMatch[];
  wins: number;
  losses: number;
  netRating: number | null;
  rankedCount: number;
}
export type HistoryItem =
  | { kind: "single"; match: HistoryMatch }
  | { kind: "group"; group: RoundRobinGroup };

export function buildHistoryMatch(
  row: HistoryRow,
  participants: HistoryParticipant[],
  approvals: HistoryApproval[],
  playerId: string
): HistoryMatch {
  const parts = participants.filter((p) => p.match_id === row.match_id);
  const teammate = parts.find(
    (p) => p.team === row.team && p.player_id !== playerId
  );
  const opponents = parts.filter((p) => p.team !== row.team);
  const votes = approvals.filter((a) => a.match_id === row.match_id);
  const m = row.matches;
  return {
    match_id: row.match_id,
    match_date: m.match_date,
    created_at: m.created_at,
    team1_score: m.team1_score,
    team2_score: m.team2_score,
    my_team: row.team as 1 | 2,
    partner_name: teammate ? resolveParticipantName(teammate) : "",
    partner_id: participantProfileId(teammate),
    partner_avatar_url: teammate?.profiles?.avatar_url,
    opponent1_name: resolveParticipantName(opponents[0]),
    opponent1_id: participantProfileId(opponents[0]),
    opponent1_avatar_url: opponents[0]?.profiles?.avatar_url,
    opponent2_name: opponents[1] ? resolveParticipantName(opponents[1]) : "",
    opponent2_id: participantProfileId(opponents[1]),
    opponent2_avatar_url: opponents[1]?.profiles?.avatar_url,
    rating_change: row.rating_change,
    rating_after: row.rating_after,
    court_name: m.other_location || m.courts?.name || "Location not recorded",
    won: didTeamWin(row.team as 1 | 2, m.team1_score, m.team2_score),
    is_ranked: m.count_for_rating !== false,
    // Linked guests can have profile links without becoming eligible approvers.
    registered_player_ids: [
      ...new Set(parts.flatMap((p) => (p.player_id ? [p.player_id] : []))),
    ],
    approval_player_ids: [...new Set(votes.map((a) => a.player_id))],
    verified_by:
      m.status === "pending"
        ? votes.filter((a) => a.approved).map((a) => a.player_id)
        : m.verified_by || [],
    source: m.source,
    round_no: m.round_no,
    court_no: m.court_no,
  };
}

export function verificationStatus(
  match: HistoryMatch,
  viewerId: string | null,
  pending = false
) {
  const eligible = new Set(
    pending ? match.approval_player_ids : match.registered_player_ids
  );
  const confirmed = new Set(match.verified_by.filter((id) => eligible.has(id)));
  return {
    verifiedCount: confirmed.size,
    totalPlayers: eligible.size,
    isCurrentUserVerified: !!viewerId && confirmed.has(viewerId),
  };
}

export function compareHistoryMatches(a: HistoryMatch, b: HistoryMatch) {
  return (
    b.match_date.localeCompare(a.match_date) ||
    b.created_at.localeCompare(a.created_at) ||
    b.match_id.localeCompare(a.match_id)
  );
}

/** Group complete events before windowing the list, so rounds never disappear. */
export function groupMatchHistory(
  matches: HistoryMatch[],
  rankedOnly = false
): HistoryItem[] {
  const groups = new Map<string, RoundRobinGroup>();
  const items: HistoryItem[] = [];
  for (const match of [...matches]
    .filter((m) => !rankedOnly || m.is_ranked)
    .sort(compareHistoryMatches)) {
    if (!match.rr_event_id) {
      items.push({ kind: "single", match });
      continue;
    }
    let group = groups.get(match.rr_event_id);
    if (!group) {
      group = {
        eventId: match.rr_event_id,
        name: match.rr_event_name || "Round robin",
        date: match.rr_event_date || match.match_date,
        matches: [],
        wins: 0,
        losses: 0,
        netRating: 0,
        rankedCount: 0,
      };
      groups.set(match.rr_event_id, group);
      items.push({ kind: "group", group });
    }
    group.matches.push(match);
    if (match.won) group.wins++;
    else group.losses++;
    if (match.is_ranked) {
      group.rankedCount++;
      // An incomplete rating total must not look like a complete zero.
      if (match.rating_change == null || !Number.isFinite(match.rating_change))
        group.netRating = null;
      else if (group.netRating != null) group.netRating += match.rating_change;
    }
  }
  for (const group of groups.values())
    group.matches.sort(
      (a, b) =>
        (a.round_no ?? Infinity) - (b.round_no ?? Infinity) ||
        (a.court_no ?? Infinity) - (b.court_no ?? Infinity) ||
        compareHistoryMatches(a, b)
    );
  return items;
}
