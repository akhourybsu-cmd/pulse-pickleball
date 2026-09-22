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
            Picture the play. Slide to your answer. Discover the skills that support your game and the ones to practise next.
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

      {/* Expectations */}
      <p className="text-center text-sm"><Link className="skill-quiet-link" to={GUIDE_PATH}>New to the terms? Explore the pickleball fundamentals guide</Link></p>
      <motion.section {...item} className="skill-intro-grid">
        <Point icon={<Gauge className="h-4 w-4" />}>
          Gives your <strong>PULSE Self-Assessed Level</strong> — separate from your match-based
          <strong> PULSE Performance Rating</strong>. It isn't an official tournament rating.
        </Point>
        <Point icon={<ListChecks className="h-4 w-4" />}>
          Think about your <strong>last 10 doubles games</strong> against similar players. Estimate successful opportunities out of 10. Shot execution, repeatability, decisions and pressure are measured separately.
        </Point>
        <Point icon={<Clock className="h-4 w-4" />}>
          Up to <strong>{maxItems}</strong> questions, with an aim of about <strong>{minItems}</strong> when there is enough evidence. Confirm each slider answer to save it. Review and change answers before finishing.
        </Point>
        <Point icon={<ShieldCheck className="h-4 w-4" />}>
          “Not enough game experience” is a valid answer. We only estimate a level when there is enough evidence. Games and coach observation are needed to validate it. {guest ? 'Your full analysis is available before signup. Answers are stored temporarily in this browser for up to 7 days.' : 'You control your skill-profile visibility in your profile settings.'}
        </Point>
      </motion.section>

      <motion.div {...item}>
        <Button onClick={onStart} disabled={starting} className="skill-primary-button h-14 w-full gap-2 rounded-xl text-[15px]">
          <PlayCircle className="h-5 w-5" />
          {starting ? "Starting…" : hasDraft ? "Resume assessment" : "Start assessment"}
        </Button>
      </motion.div>
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
