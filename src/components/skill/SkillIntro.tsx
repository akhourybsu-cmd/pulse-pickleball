import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from "framer-motion";
import { Gauge, Clock, ShieldCheck, PlayCircle, ListChecks, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { staggerContainer, staggerItem } from "@/lib/motion";
import { Logo } from '@/components/Logo';
import { PulseTrace } from './PulseTrace';
import './assessment-brand.css';
import { GUIDE_PATH } from '@/lib/skill/knowledge';

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
  guest = false,
}: {
  onStart: () => void;
  starting?: boolean;
  hasDraft?: boolean;
  minItems: number;
  maxItems: number;
  guest?: boolean;
}) {
  const reduced = useReducedMotion();
  const container = reduced ? {} : { variants: staggerContainer, initial: "hidden" as const, animate: "show" as const };
  const item = reduced ? {} : { variants: staggerItem };

  return (
    <motion.div className="skill-studio space-y-5" {...container}>
      {/* Hero */}
      <motion.header {...item} className="skill-intro-hero">
        {/* Soft gold glow backdrop (decorative). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-16 mx-auto h-40 w-40 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.18), transparent 70%)" }}
        />
        <div className="relative">
          <Logo compact className="skill-intro-logo" />
          <div className="skill-overline">The visual skill assessment</div>
          <h1>Know your game.<br /><em>Find your next focus.</em></h1>
          <p>
            See your strengths, your skill level, and what to practise next.
          </p>
          <PulseTrace className="mt-5" />
        </div>
      </motion.header>

      {/* What you'll get */}
      <motion.div {...item} className="flex flex-wrap justify-center gap-1.5">
        {[
          { icon: <Gauge className="h-3.5 w-3.5" />, label: "Self-Assessed Level" },
          { icon: <Sparkles className="h-3.5 w-3.5" />, label: "Visual game situations" },
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

      <motion.div {...item}>
        <p className="mb-3 text-center text-sm text-muted-foreground">{minItems}–{maxItems} questions · {guest ? 'Full results before signup' : 'Answers save as you go'}</p>
        <Button onClick={onStart} disabled={starting} className="skill-primary-button h-14 w-full gap-2 rounded-xl text-[15px]">
          <PlayCircle className="h-5 w-5" />
          {starting ? "Starting…" : hasDraft ? "Resume assessment" : "Start assessment"}
        </Button>
      </motion.div>

      <motion.section {...item} className="skill-intro-grid">
        <Point icon={<ListChecks className="h-4 w-4" />}>
          Think of your <strong>last 10 doubles games</strong> against similar players. For each situation, estimate how often you succeed out of 10 chances.
        </Point>
        <Point icon={<Clock className="h-4 w-4" />}>
          <strong>Slide or tap, then continue.</strong> You can review answers before finishing. Questions cover shots, consistency, decisions and pressure.
        </Point>
        <Point icon={<ShieldCheck className="h-4 w-4" />}>
          <strong>Haven’t tried it in games?</strong> Choose “Not enough game experience”. Missing experience never counts as zero skill.
        </Point>
        <Point icon={<Gauge className="h-4 w-4" />}>
          Your <strong>PULSE Self-Assessed Level</strong> is an estimate. It is separate from your PULSE Performance Rating and is not a DUPR rating.
        </Point>
      </motion.section>
      <p className="text-center text-xs leading-relaxed text-muted-foreground">{guest ? 'Keep your full analysis with a free account. Guest answers stay in this browser for up to 7 days.' : 'Manage who can see your skill profile in profile settings.'} Verify your estimated level through games or a coach.</p>
      <p className="text-center text-sm"><Link className="skill-quiet-link" to={GUIDE_PATH}>Pickleball terms & fundamentals</Link></p>
    </motion.div>
  );
}

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="skill-intro-point flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}
