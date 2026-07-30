import { motion, useReducedMotion } from "framer-motion";
import { Gauge, Clock, ShieldCheck, PlayCircle, ListChecks, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staggerContainer, staggerItem } from "@/lib/motion";

/**
 * Assessment introduction. Sets expectations before the player starts:
 * what it estimates, that it is SEPARATE from the match-based rating, how
 * to answer honestly, length, save-and-resume, and privacy. Premium, mobile
 * first, with a reduced-motion-safe staggered entrance.
 */
export function SkillIntro({
  onStart,
  starting,
  hasDraft,
  minItems,
  maxItems,
}: {
  onStart: () => void;
  starting?: boolean;
  hasDraft?: boolean;
  minItems: number;
  maxItems: number;
}) {
  const reduced = useReducedMotion();
  const container = reduced ? {} : { variants: staggerContainer, initial: "hidden" as const, animate: "show" as const };
  const item = reduced ? {} : { variants: staggerItem };

  return (
    <motion.div className="space-y-5" {...container}>
      {/* Hero */}
      <motion.header {...item} className="relative overflow-hidden rounded-3xl border border-border/70 bg-card px-6 py-8 text-center shadow-sm">
        {/* Soft gold glow backdrop (decorative). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-16 mx-auto h-40 w-40 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)" }}
        />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/25 shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.5)]">
            <Gauge className="h-8 w-8" />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">PULSE</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">Skill Assessment</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            A quick, adaptive self-assessment that estimates your current ability and builds your
            personal Skill Fingerprint.
          </p>
        </div>
      </motion.header>

      {/* What you'll get */}
      <motion.div {...item} className="flex flex-wrap justify-center gap-1.5">
        {[
          { icon: <Gauge className="h-3.5 w-3.5" />, label: "Self-Assessed Level" },
          { icon: <Sparkles className="h-3.5 w-3.5" />, label: "Play style" },
          { icon: <TrendingUp className="h-3.5 w-3.5" />, label: "Strengths & priorities" },
        ].map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-foreground/80"
          >
            <span className="text-primary">{c.icon}</span>
            {c.label}
          </span>
        ))}
      </motion.div>

      {/* Expectations */}
      <motion.section {...item} className="space-y-2.5">
        <Point icon={<Gauge className="h-4 w-4" />}>
          Gives your <strong>PULSE Self-Assessed Level</strong> — separate from your match-based
          <strong> PULSE Performance Rating</strong>. It isn't an official tournament rating.
        </Point>
        <Point icon={<ListChecks className="h-4 w-4" />}>
          Answer for your <strong>normal games</strong> against players near your level — your last
          ten games or past 90 days, not drills or your best-ever day.
        </Point>
        <Point icon={<Clock className="h-4 w-4" />}>
          Adaptive — most people answer about <strong>{minItems}–{maxItems}</strong> questions.
          Progress saves as you go, so you can leave and pick up right where you left off.
        </Point>
        <Point icon={<ShieldCheck className="h-4 w-4" />}>
          Your answers stay <strong>private</strong>. You control whether your level shows on your
          profile, and “Not sure” is always a fine answer.
        </Point>
      </motion.section>

      <motion.div {...item}>
        <Button onClick={onStart} disabled={starting} className="h-12 w-full gap-2 rounded-xl text-[15px] font-semibold shadow-[0_8px_24px_-8px_hsl(var(--primary)/0.6)]">
          <PlayCircle className="h-5 w-5" />
          {starting ? "Starting…" : hasDraft ? "Resume assessment" : "Start assessment"}
        </Button>
      </motion.div>
    </motion.div>
  );
}

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
