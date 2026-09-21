import { Activity, Trophy } from "lucide-react";

interface PlayerEventBriefingProps {
  status: string;
  round: number;
  court?: number;
  resting?: boolean;
  completedMatch?: boolean;
  team?: string;
  opponents?: string;
  wins?: number;
  gamesPlayed?: number;
}

/** A glanceable courtside summary, derived only from the saved event and schedule. */
export function PlayerEventBriefing({ status, round, court, resting, completedMatch, team, opponents, wins, gamesPlayed }: PlayerEventBriefingProps) {
  const finished = status === "completed";
  const live = status === "live";
  const title = status === "voided" ? "Event voided" : finished ? "That's a wrap." : live && resting ? "Take a breather." : court ? `Court ${court}` : live ? "Follow the action." : "See you on court.";
  return (
    <aside className="rr-player-briefing" aria-label="Your event at a glance">
      <div className="rr-briefing-label flex items-center gap-2"><Activity className="h-4 w-4" />Your PULSE</div>
      <h2>{title}</h2>
      <p className="rr-briefing-copy">
        {status === "voided" ? "This event is no longer active." : finished ? "Your event results are ready in Standings." : live && resting ? `You're resting in Round ${round}. Check the schedule for your next game.` : court ? `Round ${round} · ${completedMatch ? "Result recorded" : live ? "Your current assignment" : "Your opening assignment"}` : live ? "Explore the current round, players and standings below." : "The host will get things started. Your assignments appear here when the schedule is ready."}
      </p>
      {court && !resting && !finished && status !== "voided" && (
        <dl className="rr-briefing-detail">
          <div><dt>Your team</dt><dd>{team}</dd></div>
          <div className="mt-4 max-md:mt-0"><dt>Across the net</dt><dd>{opponents}</dd></div>
        </dl>
      )}
      {!!gamesPlayed && (
        <div className="rr-briefing-detail flex items-center gap-3"><Trophy className="h-5 w-5 text-primary" /><p className="text-sm"><strong>{wins ?? 0} {wins === 1 ? "win" : "wins"}</strong><span className="opacity-60"> · {gamesPlayed} {gamesPlayed === 1 ? "game" : "games"} played</span></p></div>
      )}
    </aside>
  );
}
