import { Activity, ArrowRight, Check, Coffee, Flag, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlayerEventBriefingProps {
  status: string;
  round: number;
  totalRounds: number;
  court?: number;
  resting?: boolean;
  completedMatch?: boolean;
  team?: string[];
  opponents?: string[];
  score?: [number | null, number | null];
  next?: { round: number; court: number };
  wins?: number;
  gamesPlayed?: number;
  onExplore: (view: string) => void;
}

/** A glanceable courtside summary, derived only from the saved event and schedule. */
export function PlayerEventBriefing({ status, round, totalRounds, court, resting, completedMatch, team, opponents, score, next, wins = 0, gamesPlayed = 0, onExplore }: PlayerEventBriefingProps) {
  const finished = status === "completed";
  const voided = status === "voided";
  const live = status === "live";
  const assigned = court != null && !resting && !finished && !voided;
  const title = voided ? "Event voided" : finished ? "That's a wrap." : live && resting ? "Take a breather." : assigned ? `Court ${court}` : live ? "Stay ready." : "See you on court.";
  const instruction = voided ? "This event is no longer active." : finished ? "Your final results are ready."
    : live && resting ? next ? "Rest this round. Your next assignment is below." : "Rest this round. Follow your host's next update."
    : assigned && completedMatch ? "Score recorded. Wait for the host to start the next round."
    : assigned && live ? "Head to your court. Your host records the score."
    : assigned ? "Your opening matchup is ready. Wait for your host to start."
    : live ? "Your host will confirm your assignment. Check the schedule for updates."
    : "Your court appears here when the host prepares the schedule.";
  const StateIcon = voided ? Flag : finished ? Trophy : resting ? Coffee : completedMatch ? Check : Activity;
  const showScore = assigned && completedMatch && score?.every(value => value != null);
  return (
    <section className="rr-player-mission" aria-label="Your event at a glance">
      <div className="rr-mission-topline">
        <span><Activity size={14} aria-hidden="true" />Your PULSE</span>
        <span>{voided ? "Voided" : finished ? "Event complete" : `Round ${round} / ${totalRounds}`}</span>
      </div>
      <div className="rr-mission-body" key={`${status}-${round}-${court}-${resting}-${completedMatch}`}>
        <div className="rr-mission-heading" aria-live="polite" aria-atomic="true">
          <span className="rr-mission-kicker">{assigned ? completedMatch ? "Round complete" : live ? "You're up" : "Opening assignment" : "Your next step"}</span>
          <h2>{title}</h2>
          <p>{instruction}</p>
        </div>
        {assigned ? (
          <div className="rr-match-court" aria-label="Your matchup">
            <div className="rr-court-team rr-court-team-you">
              <span className="rr-team-label">Your team</span>
              {team?.map((name, index) => <strong key={index}>{name}</strong>)}
              {showScore && <span className="rr-court-result" aria-label={`Your score ${score![0]}`}>{score![0]}</span>}
            </div>
            <span className="rr-court-vs" aria-hidden="true">VS</span>
            <div className="rr-court-team">
              <span className="rr-team-label">Across the net</span>
              {opponents?.map((name, index) => <strong key={index}>{name}</strong>)}
              {showScore && <span className="rr-court-result" aria-label={`Opponent score ${score![1]}`}>{score![1]}</span>}
            </div>
          </div>
        ) : (
          <div className="rr-mission-state" aria-hidden="true"><div><StateIcon strokeWidth={1.2} /></div><span>PLAY · CONNECT · REPEAT</span></div>
        )}
        <div className="rr-mission-next">
          <span className="rr-mission-next-icon"><StateIcon size={18} aria-hidden="true" /></span>
          <div><span>{finished ? "Your event" : voided ? "Event record" : "Up next"}</span>
            <p>{finished ? `${wins} ${wins === 1 ? "win" : "wins"} · ${gamesPlayed} ${gamesPlayed === 1 ? "game" : "games"} played`
              : voided ? "Schedule and results remain available."
              : next ? `Round ${next.round} · Court ${next.court}`
              : completedMatch ? "Wait for your host's next update."
              : "Follow your host's round announcements."}</p>
            {next && !finished && !voided && <small>After your host advances the round</small>}
          </div>
        </div>
      </div>
      <div className="rr-mission-footer">
        <span>{!voided && !finished ? `${wins} ${wins === 1 ? "win" : "wins"} · ${gamesPlayed} played` : "Made for the court."}</span>
        <Button variant="ghost" onClick={() => onExplore(finished ? "standings" : "schedule")}>
          {finished ? "View standings" : "Full schedule"}<ArrowRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
