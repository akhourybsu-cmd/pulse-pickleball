interface Assignment {
  round_no: number;
  court_no: number;
  is_bye: boolean;
  a1_player_id: string | null;
  a2_player_id: string | null;
  b1_player_id: string | null;
  b2_player_id: string | null;
  a1_guest_id: string | null;
  a2_guest_id: string | null;
  b1_guest_id: string | null;
  b2_guest_id: string | null;
  completed: boolean;
}

/** Read the saved assignments without advancing the event or predicting pairings. */
export function playerRoundFocus<T extends Assignment>(schedule: T[], ids: Set<string>, round: number) {
  const includesPlayer = (match: T) => [
    match.a1_player_id, match.a2_player_id, match.b1_player_id, match.b2_player_id,
    match.a1_guest_id, match.a2_guest_id, match.b1_guest_id, match.b2_guest_id,
  ].some(id => id != null && ids.has(id));
  const isRest = (match: T) => match.is_bye || !(match.a1_player_id ?? match.a1_guest_id)
    || !(match.b1_player_id ?? match.b1_guest_id)
    || (match.a1_player_id ?? match.a1_guest_id) === (match.b1_player_id ?? match.b1_guest_id);
  const mine = schedule.filter(includesPlayer);
  const current = mine.find(match => match.round_no === round);
  const next = mine.filter(match => match.round_no > round && !isRest(match) && !match.completed)
    .sort((a, b) => a.round_no - b.round_no)[0];
  const onTeamA = current && [current.a1_player_id, current.a2_player_id, current.a1_guest_id, current.a2_guest_id]
    .some(id => id != null && ids.has(id));
  return { current, next, onTeamA, resting: current ? isRest(current) : false };
}
