import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, LogIn, TrendingUp, Activity } from "lucide-react";
import { CourtMotif } from "./CourtMotif";

/**
 * Hero — pickleball-first.
 *
 * Signals the sport immediately (court motif + a live-looking PULSE
 * rating card) instead of a generic SaaS gradient. Primary CTA drives
 * sign-up; secondary returns existing players to their dashboard.
 */
export const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden py-16 md:py-24 lg:py-28">
      {/* Background: single-hue wash + a faint full court behind everything. */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-primary/5" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[620px] bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <CourtMotif className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1100px] max-w-none text-primary/[0.06]" />
      </div>

      <div className="container mx-auto px-4">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-12 lg:gap-8 items-center">
          {/* Left: message */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-xs font-semibold text-primary mb-6">
              <Activity className="h-3.5 w-3.5" />
              Your pulse on the court
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display leading-[1.05] mb-5">
              Every dink, drive,{" "}
              <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                and rating
              </span>{" "}
              in one app.
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-9">
              Record matches in seconds, watch your PULSE rating climb, run round
              robins and leagues, and rally your local pickleball crew — all in
              one place.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start items-center">
              <Button
                size="lg"
                onClick={() => navigate("/auth")}
                className="group h-14 px-10 text-lg font-semibold bg-gradient-to-r from-primary to-primary/85 hover:shadow-xl hover:shadow-primary/25 hover:scale-105 transition-all duration-300 w-full sm:w-auto"
              >
                Get Started — Free
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/auth")}
                className="h-14 px-8 text-lg font-semibold w-full sm:w-auto"
              >
                <LogIn className="mr-2 h-5 w-5" />
                Sign In
              </Button>
            </div>

            {/* Trust chips */}
            <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Free to start
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Singles &amp; doubles
              </span>
            </div>
          </div>

          {/* Right: product-glimpse rating card so the sport + product read
              instantly without a screenshot asset. */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="rounded-3xl border border-border/60 bg-card shadow-[0_16px_50px_-12px_hsl(220_10%_12%/0.22)] p-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  <Activity className="h-3.5 w-3.5 text-primary" />
                  PULSE Rating
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                  <TrendingUp className="h-3 w-3" />
                  +0.18
                </span>
              </div>

              <div className="flex items-end gap-2 mb-1">
                <span className="font-display text-5xl font-black tabular-nums leading-none">
                  4.12
                </span>
                <span className="text-sm text-muted-foreground mb-1">this week</span>
              </div>
              <p className="text-xs text-muted-foreground mb-5">
                Up from 3.94 · 6 matches recorded
              </p>

              {/* Sparkline-ish trend bars */}
              <div className="flex items-end gap-1.5 h-16 mb-5" aria-hidden>
                {[38, 44, 40, 52, 48, 63, 71, 68, 82, 90].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-gradient-to-t from-primary/40 to-primary"
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>

              {/* Recent match row */}
              <div className="rounded-xl bg-muted/50 p-3 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Latest · Doubles</div>
                  <div className="text-sm font-semibold truncate">You &amp; Jordan</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold tabular-nums">11–7</div>
                  <div className="text-[11px] font-semibold text-primary">Win</div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
