import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Player-facing "How this ladder works" explainer for the league page (ladder
 * leagues). Collapsible so it stays out of the way once understood; mirrors the
 * copy managers see in LadderTab's inline explainer, but written for players and
 * pointing at the actions they can take. Rendered on PlayerLeagueDetail so a
 * player who deep-links straight into their league still learns the format
 * (the portal explainer isn't seen on that path).
 */
export function LadderHowItWorks({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="lg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <Layers className="h-4 w-4 shrink-0 text-[color:var(--lg-accent-gold)]" />
        <span className="flex-1 text-sm font-semibold text-[color:var(--lg-text)]">
          How this ladder works
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[color:var(--lg-text-dim)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div className="space-y-2 border-t border-[color:var(--lg-border)] px-4 py-3 text-xs leading-relaxed text-[color:var(--lg-text-dim)]">
          <p>
            You're ranked{" "}
            <strong className="text-[color:var(--lg-text)]">individually</strong> on
            the ladder — there's no fixed team or partner.
          </p>
          <p>
            Each week the ladder is split into{" "}
            <strong className="text-[color:var(--lg-text)]">groups of four</strong> by
            position (1–4 share a court, 5–8 the next, and so on). In your group you
            play <strong className="text-[color:var(--lg-text)]">three games</strong>,
            partnering each of the other three once — so you compete as an individual.
          </p>
          <p>
            Once every game in your group is scored, the group's{" "}
            <strong className="text-[color:var(--lg-text)]">winner moves up a court</strong>{" "}
            and <strong className="text-[color:var(--lg-text)]">4th moves down</strong>.
            The ladder re-sorts and the next round builds fresh groups from the new
            positions.
          </p>
          <p>
            Can't make a week? Use the{" "}
            <strong className="text-[color:var(--lg-text)]">“Can't make a week?”</strong>{" "}
            card above to request a sub. The organizer will either bring in a fill-in
            or sit you out for that week — either way you keep your spot on the ladder.
          </p>
        </div>
      )}
    </div>
  );
}
