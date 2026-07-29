import { Gauge, Clock, ShieldCheck, PlayCircle, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Assessment introduction. Sets expectations before the player starts:
 * what it estimates, that it is SEPARATE from the match-based rating, how
 * to answer honestly, length, save-and-resume, and privacy.
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
  return (
    <div className="space-y-5">
      <header className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          <Gauge className="h-6 w-6" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">PULSE Skill Assessment</h1>
        <p className="mt-1.5 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          A structured self-assessment that estimates your current pickleball ability and builds
          your Skill Fingerprint.
        </p>
      </header>

      <section className="rounded-2xl border border-border/70 bg-card p-4 space-y-3 text-sm">
        <Point icon={<Gauge className="h-4 w-4 text-primary" />}>
          This gives your <strong>PULSE Self-Assessed Level</strong> — separate from your
          match-based <strong>PULSE Performance Rating</strong>. It is not an official tournament rating.
        </Point>
        <Point icon={<ListChecks className="h-4 w-4 text-primary" />}>
          Answer based on your normal games against players near your level — think about your
          last ten games or the past 90 days, not drills or your best-ever day.
        </Point>
        <Point icon={<Clock className="h-4 w-4 text-primary" />}>
          Adaptive — most people answer about {minItems}–{maxItems} questions. Your progress saves
          as you go, so you can leave and pick up right where you left off.
        </Point>
        <Point icon={<ShieldCheck className="h-4 w-4 text-primary" />}>
          Your answers are private. You control whether your level appears on your profile, and
          “Not sure” is always a fine answer.
        </Point>
      </section>

      <Button onClick={onStart} disabled={starting} className="w-full h-12 gap-2 font-semibold text-[15px]">
        <PlayCircle className="h-5 w-5" />
        {starting ? "Starting…" : hasDraft ? "Resume assessment" : "Start assessment"}
      </Button>
    </div>
  );
}

function Point({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
