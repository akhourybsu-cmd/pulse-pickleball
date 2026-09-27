import { supabase } from "@/integrations/supabase/client";
import { resolvePlayerName } from "./matchDisplay";
import {
  buildHistoryMatch,
  compareHistoryMatches,
  type HistoryRow,
  type HistoryParticipant,
  type HistoryApproval,
  type HistoryMatch,
} from "./matchHistory";

/** Read in bounded batches instead of one request for every match. */
export async function loadMatchHistory(
  playerId: string,
  ownHistory: boolean,
  signal: AbortSignal
) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles_public")
    .select("full_name, display_name, avatar_url")
    .eq("id", playerId)
    .abortSignal(signal)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw new Error("This player profile is no longer available.");
  const rows: HistoryRow[] = [];
  // Explicit pagination avoids the API's default row limit silently truncating history.
  for (let from = 0; ; from += 200) {
    const { data, error } = await supabase
      .from("match_participants")
      .select(
        `
      match_id, team, rating_change, rating_after,
      matches!inner(match_date, created_at, team1_score, team2_score, status, voided,
        count_for_rating, other_location, courts(name), verified_by, source, round_no, court_no)
    `
      )
      .eq("player_id", playerId)
      .in("matches.status", ownHistory ? ["approved", "pending"] : ["approved"])
      .not("matches.voided", "is", true)
      .order("match_id")
      .range(from, from + 199)
      .abortSignal(signal);
    if (error) throw error;
    rows.push(...((data as unknown as HistoryRow[]) ?? []));
    if (!data || data.length < 200) break;
  }
  const matches: HistoryMatch[] = [];
  const pendingMatches: HistoryMatch[] = [];
  for (let from = 0; from < rows.length; from += 100) {
    const batch = rows.slice(from, from + 100);
    const ids = batch.map((row) => row.match_id);
    const { data: participants, error: participantError } = await supabase
      .from("match_participants")
      .select(
        `
      match_id, player_id, guest_player_id, team,
      profiles:profiles_public!match_participants_player_id_fkey(full_name, display_name, avatar_url),
      guest:guest_players!match_participants_guest_player_id_fkey(display_name, linked_user_id)
    `
      )
      .in("match_id", ids)
      .abortSignal(signal);
    if (participantError) throw participantError;
    const pendingIds = batch
      .filter((row) => row.matches.status === "pending")
      .map((row) => row.match_id);
    let approvals: HistoryApproval[] = [];
    if (pendingIds.length) {
      const { data, error } = await supabase
        .from("match_approvals")
        .select("match_id, player_id, approved")
        .in("match_id", pendingIds)
        .abortSignal(signal);
      if (error) throw error;
      approvals = data || [];
    }
    for (const row of batch) {
      const match = buildHistoryMatch(
        row,
        (participants as unknown as HistoryParticipant[]) || [],
        approvals,
        playerId
      );
      (row.matches.status === "pending" ? pendingMatches : matches).push(match);
    }
    const rrIds = batch
      .filter((row) => row.matches.source === "round_robin")
      .map((row) => row.match_id);
    if (!rrIds.length) continue;
    const { data: links, error: linkError } = await supabase
      .from("round_robin_schedule")
      .select("match_id, event_id")
      .in("match_id", rrIds)
      .abortSignal(signal);
    if (linkError) throw linkError;
    const eventIds = [
      ...new Set((links || []).map((link) => link.event_id).filter(Boolean)),
    ];
    if (!eventIds.length) continue;
    const { data: events, error: eventError } = await supabase
      .from("round_robin_events")
      .select("id, name, date")
      .in("id", eventIds)
      .abortSignal(signal);
    if (eventError) throw eventError;
    const eventsById = new Map(
      (events || []).map((event) => [event.id, event])
    );
    const linksByMatch = new Map(
      (links || []).map((link) => [link.match_id, link.event_id])
    );
    for (const match of [...matches, ...pendingMatches]) {
      const eventId = linksByMatch.get(match.match_id);
      if (!eventId) continue;
      const event = eventsById.get(eventId);
      match.rr_event_id = eventId;
      match.rr_event_name = event?.name || "Round robin";
      match.rr_event_date = event?.date || match.match_date;
    }
  }
  return {
    playerName: resolvePlayerName(profile),
    playerAvatarUrl: profile.avatar_url,
    matches: matches.sort(compareHistoryMatches),
    pendingMatches: pendingMatches.sort(compareHistoryMatches),
  };
}
