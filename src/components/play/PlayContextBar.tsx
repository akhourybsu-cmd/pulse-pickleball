import { Users, Trophy, Gamepad2, GraduationCap, Star, Sparkles, type LucideIcon } from "lucide-react";
import type { EventTypeFilter } from "@/hooks/useDiscoverEvents";

interface ContextCopy {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * CSS variable name (without `--`) holding the per-event-type HSL triplet.
   * Defined in src/index.css for both light and dark themes so each event
   * type has consistent design-system coloring across the app.
   */
  toneVar: string;
}

/**
 * Per-event-type contextual intro shown above the results grid.
 *
 * When the player narrows the filter to a specific play type, this strip
 * gives a one-line definition so newcomers understand what they're filtering
 * for. Returns null on the "all" filter — the hub header copy is enough there.
 *
 * Colors come from design-system CSS variables (`--event-*`) instead of
 * ad-hoc Tailwind palette literals — see :root / .dark blocks in index.css.
 */
const CONTEXT_COPY: Partial<Record<EventTypeFilter, ContextCopy>> = {
  round_robin: {
    icon: Users,
    title: "Round Robins",
    description: "Rotate through multiple games with different partners. Standings are tracked across rounds.",
    toneVar: "event-round-robin",
  },
  tournament: {
    icon: Trophy,
    title: "Tournaments",
    description: "Competitive events with divisions and brackets. Register a team or play singles.",
    toneVar: "event-tournament",
  },
  open_play: {
    icon: Gamepad2,
    title: "Open Play",
    description: "Drop-in games with rotating partners. Show up, play, meet people.",
    toneVar: "event-open-play",
  },
  clinic: {
    icon: GraduationCap,
    title: "Clinics & Lessons",
    description: "Coached sessions to sharpen specific skills.",
    toneVar: "event-clinic",
  },
  league: {
    icon: Star,
    title: "Leagues",
    description: "Recurring play across a season with standings.",
    toneVar: "event-league",
  },
  social: {
    icon: Sparkles,
    title: "Socials",
    description: "Casual community events centered on play and people.",
    toneVar: "event-social",
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
  const tone = `hsl(var(--${copy.toneVar}))`;
  const toneBg = `hsl(var(--${copy.toneVar}) / 0.1)`;

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card mb-3">
      <div
        className="p-2 rounded-lg flex-shrink-0"
        style={{ backgroundColor: toneBg, color: tone }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground leading-tight">{copy.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{copy.description}</p>
      </div>
    </div>
  );
}
