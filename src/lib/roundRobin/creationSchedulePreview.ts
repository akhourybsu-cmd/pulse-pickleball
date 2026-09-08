import {
  planScheduleAdjustment,
  type ScheduleAdjustmentPlan,
} from "./scheduleAdjustment";
import type { EventFormat, SeatId } from "./scheduleCore";

export interface CreationPreviewParticipant {
  id: string;
  isGuest?: boolean;
  gender?: string | null;
}

/**
 * Builds a creation-time preview from the exact selected roster. Count-only
 * and open-registration flows intentionally do not use this helper because
 * their gender composition is not known yet.
 */
export function planCreationSchedulePreview({
  participants,
  numCourts,
  gamesPerPlayer,
  format,
}: {
  participants: readonly CreationPreviewParticipant[];
  numCourts: number;
  gamesPerPlayer: number;
  format: EventFormat;
}): ScheduleAdjustmentPlan | null {
  if (participants.length < 4 || numCourts < 1 || gamesPerPlayer < 1) {
    return null;
  }

  const seatIds = participants.map(
    (participant): SeatId => `${participant.isGuest ? "g" : "p"}:${participant.id}`,
  );
  const genders = new Map<SeatId, string>();
  participants.forEach((participant, index) => {
    if (participant.gender) genders.set(seatIds[index], participant.gender);
  });

  return planScheduleAdjustment({
    seed: `creation:${seatIds.join("|")}`,
    currentMatches: [],
    currentSeatIds: seatIds,
    nextSeatIds: seatIds,
    currentNumCourts: numCourts,
    currentGamesPerPlayer: gamesPerPlayer,
    currentTotalRounds: 0,
    firstMutableRound: 1,
    numCourts,
    gamesPerPlayer,
    format,
    genders,
    lateJoinCredit: "none",
  });
}
