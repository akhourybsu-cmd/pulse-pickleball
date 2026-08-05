import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { OnboardingLayout } from "./OnboardingLayout";
import { Star, Swords, CheckCircle2, Trophy, UsersRound } from "lucide-react";
import CountUp from "react-countup";

interface OnboardingRatingRevealProps {
  /** The player's starting PULSE rating (their self-rating, or 3.00). */
  currentRating: number;
  /** Retained for the page's prop shape; not shown pre-first-match. */
  ratingChange?: number;
  onContinue: () => void;
}

// Step 2 of 3 — "How PULSE works". Match-free by design: it teaches the rating
// and the core loop up front (the concepts a skipper would otherwise never
// meet), and shows the player's STARTING rating rather than a post-match reveal.
export const OnboardingRatingReveal = ({
  currentRating,
  onContinue,
}: OnboardingRatingRevealProps) => {
  const startingRating = currentRating || 3.0;

  return (
    <OnboardingLayout currentStep={1}>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="mb-1 text-2xl font-bold text-foreground">How PULSE works</h1>
          <p className="text-sm text-muted-foreground">
            One number that tracks your real level — and how to grow it.
          </p>
        </div>

        {/* Starting rating */}
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-6">
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your starting PULSE rating
            </p>
            <div className="mt-2 flex items-center justify-center gap-2">
              <Star className="h-7 w-7 text-primary" />
              <span className="text-5xl font-bold text-foreground">
                <CountUp end={startingRating} decimals={2} duration={1} />
              </span>
              <Star className="h-7 w-7 text-primary" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              It becomes real as you record matches — nothing is locked in yet.
            </p>
          </div>
        </div>

        {/* How the number moves */}
        <div className="space-y-2.5 rounded-xl bg-muted/50 p-4">
          <p className="text-sm font-semibold text-foreground">Every match adjusts it</p>
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Beat stronger players</strong> and you gain more;
            {" "}<strong className="text-foreground">lose to weaker ones</strong> and you drop more.
            Close games move it less. It's an ELO-based score, so it finds your true level fast.
          </p>
        </div>

        {/* The core loop — three things you'll do */}
        <div className="space-y-2">
          <Row icon={Swords} title="Record your matches"
               desc="Log a game and both sides confirm the score — that's what updates your rating." />
          <Row icon={Trophy} title="Join leagues & ladders"
               desc="Play a season, climb the standings — matches there count too." />
          <Row icon={UsersRound} title="Connect with players"
               desc="Add friends, find people at your level, and set up games." />
        </div>

        {/* Verification note — sets the right expectation early */}
        <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-card px-3 py-2.5">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-xs text-muted-foreground">
            A recorded match stays <strong className="text-foreground">pending</strong> until the
            other players confirm it — then everyone's rating updates together.
          </p>
        </div>

        <Button onClick={onContinue} className="h-12 w-full text-base font-semibold">
          Continue
        </Button>
      </div>
    </OnboardingLayout>
  );
};

function Row({ icon: Icon, title, desc }: { icon: typeof Star; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Icon className="h-[18px] w-[18px] text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}
