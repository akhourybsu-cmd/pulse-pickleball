import { CalendarDays, Trophy, Users, Activity } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import "./event.css";

/** Keep the visible navigation in Radix so arrows, focus and panels stay linked. */
export function EventTabs({ playerCount, playerHome = false }: { playerCount?: number; playerHome?: boolean }) {
  return (
    <TabsList className={`rr-event-tabs ${playerHome ? "rr-player-tabs" : ""}`} aria-label="Event views">
      {playerHome && <TabsTrigger value="court"><Activity aria-hidden="true" />Your court</TabsTrigger>}
      <TabsTrigger value="schedule"><CalendarDays aria-hidden="true" />Schedule</TabsTrigger>
      <TabsTrigger value="players"><Users aria-hidden="true" />Players{playerCount != null && <span className="rr-tab-count">{playerCount}</span>}</TabsTrigger>
      <TabsTrigger value="standings"><Trophy aria-hidden="true" />Standings</TabsTrigger>
    </TabsList>
  );
}
