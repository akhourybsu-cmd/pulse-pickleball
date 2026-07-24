import { useState } from "react";
import {
  ChevronDown, HelpCircle, Plus, CalendarDays, CalendarClock, Trophy,
} from "lucide-react";
import { LEAGUE_TYPE_META, LEAGUE_TYPES } from "@/lib/leagues/typeMeta";
import { cn } from "@/lib/utils";

/**
 * Plain-language explainer for league play, surfaced on the leagues
 * portal. Collapsible so it stays out of the way for returning users
 * but opens automatically for first-timers (no leagues yet).
 *
 * Two parts:
 *   1. How it works — the season → play → standings flow in four steps.
 *   2. League formats — every league type, its one-liner, and what it
 *      means, straight from the shared LEAGUE_TYPE_META so the copy
 *      never drifts from the create flow.
 */

const STEPS: Array<{ icon: typeof Plus; title: string; body: string }> = [
  {
    icon: Plus,
    title: "Create or join",
    body: "Start your own league — your first one is free — or join an existing one with an invite code.",
  },
  {
    icon: CalendarDays,
    title: "Set up a season",
    body: "Add a season, set the league's skill level, and enroll members or pair them into teams.",
  },
  {
    icon: CalendarClock,
    title: "Play each week",
    body: "Organizers post weekly sessions and matchups. Players report scores; anything disputed goes to the organizer.",
  },
  {
    icon: Trophy,
    title: "Climb the standings",
    body: "Wins, point differential, and recent form update automatically as scores come in.",
  },
];

export function LeaguesExplainer({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-2xl border border-border/70 bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <HelpCircle className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold">How league play works</h2>
            <p className="text-[11px] text-muted-foreground truncate">
              Formats, seasons, and how scoring works
            </p>
          </div>
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground shrink-0 transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-5 border-t border-border/50 pt-4">
          {/* Flow */}
          <ol className="grid gap-3 sm:grid-cols-2">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={s.title} className="flex gap-3">
                  <div className="relative shrink-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="absolute -top-1.5 -left-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center ring-2 ring-card">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{s.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {s.body}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Formats */}
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground mb-2">
              League formats
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {LEAGUE_TYPES.map((t) => {
                const meta = LEAGUE_TYPE_META[t];
                const Icon = meta.icon;
                return (
                  <div
                    key={t}
                    className="rounded-xl border border-border/60 bg-background/50 p-3 flex gap-3"
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      meta.chip,
                    )}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-bold">{meta.label}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {meta.tagline}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
