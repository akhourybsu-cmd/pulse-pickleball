import { Users, Trophy, Gamepad2, GraduationCap, Star, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventTypeFilter } from "@/hooks/useDiscoverEvents";

interface ContextCopy {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Tailwind color classes for the icon tile, matching the UnifiedEventCard type badge palette. */
  tone: string;
}

/**
 * Per-event-type contextual intro shown above the results grid.
 *
 * When the player narrows the filter to a specific play type, this strip
 * gives a one-line definition so newcomers understand what they're filtering
 * for. Returns null on the "all" filter — the hub header copy is enough there.
 */
const CONTEXT_COPY: Partial<Record<EventTypeFilter, ContextCopy>> = {
  round_robin: {
    icon: Users,
    title: "Round Robins",
    description: "Rotate through multiple games with different partners. Standings are tracked across rounds.",
    tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  },
  tournament: {
    icon: Trophy,
    title: "Tournaments",
    description: "Competitive events with divisions and brackets. Register a team or play singles.",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  open_play: {
    icon: Gamepad2,
    title: "Open Play",
    description: "Drop-in games with rotating partners. Show up, play, meet people.",
    tone: "bg-green-500/10 text-green-600 dark:text-green-400",
  },
  clinic: {
    icon: GraduationCap,
    title: "Clinics & Lessons",
    description: "Coached sessions to sharpen specific skills.",
    tone: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  },
  league: {
    icon: Star,
    title: "Leagues",
    description: "Recurring play across a season with standings.",
    tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
  social: {
    icon: Users,
    title: "Socials",
    description: "Casual community events centered on play and people.",
    tone: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
  },
};

interface PlayContextBarProps {
  eventType: EventTypeFilter;
}

export function PlayContextBar({ eventType }: PlayContextBarProps) {
  if (eventType === "all") return null;

  const copy = CONTEXT_COPY[eventType];
  if (!copy) return null;

  const Icon = copy.icon;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card mb-3">
      <div className={cn("p-2 rounded-lg flex-shrink-0", copy.tone)}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{copy.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{copy.description}</p>
      </div>
    </div>
  );
}
