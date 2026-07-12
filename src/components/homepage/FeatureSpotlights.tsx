import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trophy, Check, ArrowRight } from "lucide-react";
import { CourtMotif } from "./CourtMotif";

/**
 * Two alternating deep-dive bands for the flagship organizer surfaces —
 * Round Robins and Leagues — that the top-level feature grid can only
 * name in a sentence. This is where the landing "showcases everything":
 * the depth (guests, kiosk, seasons, formats, freemium) lives here.
 */

const spotlights = [
  {
    icon: RotateCcw,
    eyebrow: "Round Robins",
    title: "Open play, perfectly organized",
    body: "Set the players and courts — PULSE builds fair, rotating matchups for you. Add guests who aren't on the app yet, run a big-screen scoring kiosk, and watch standings update every round.",
    points: [
      "Auto-balanced pairings & byes",
      "Guest players, no account needed",
      "Live kiosk scoring + standings",
    ],
    cta: "Host a round robin",
    flip: false,
  },
  {
    icon: Trophy,
    eyebrow: "Leagues",
    title: "Run a real season — your first is free",
    body: "Singles, doubles, team, flex, or ladder. Set up seasons and divisions, track standings, and hand out an invite code so players join themselves. Create your first league free; add more anytime.",
    points: [
      "Five league formats",
      "Seasons, divisions & standings",
      "Shareable invite codes",
    ],
    cta: "Create your first league",
    flip: true,
  },
];

export const FeatureSpotlights = () => {
  const navigate = useNavigate();

  return (
    <section className="py-8 md:py-12">
      <div className="container mx-auto px-4 space-y-6 md:space-y-8">
        {spotlights.map((s) => (
          <div
            key={s.eyebrow}
            className="relative overflow-hidden rounded-3xl border border-border/60 bg-card"
          >
            <CourtMotif
              className={`absolute top-1/2 -translate-y-1/2 w-[520px] max-w-none text-primary/[0.05] ${
                s.flip ? "left-0 -translate-x-1/4" : "right-0 translate-x-1/4"
              }`}
            />
            <div
              className={`relative grid lg:grid-cols-2 gap-8 lg:gap-12 items-center p-7 md:p-12 ${
                s.flip ? "lg:[&>*:first-child]:order-2" : ""
              }`}
            >
              {/* Copy */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary mb-4">
                  <s.icon className="h-3.5 w-3.5" />
                  {s.eyebrow}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold font-display mb-4">
                  {s.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed mb-6 max-w-lg">
                  {s.body}
                </p>
                <ul className="space-y-2.5 mb-8">
                  {s.points.map((p) => (
                    <li key={p} className="flex items-center gap-3 text-sm font-medium">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary shrink-0">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => navigate("/auth")}
                  className="group h-12 px-6 font-semibold"
                >
                  {s.cta}
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>

              {/* Visual placeholder tile — big iconographic panel keeps the
                  band lively without a screenshot asset. */}
              <div className="relative aspect-[4/3] rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 flex items-center justify-center">
                <s.icon className="h-24 w-24 md:h-32 md:w-32 text-primary/25" strokeWidth={1.25} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-primary animate-ping" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
