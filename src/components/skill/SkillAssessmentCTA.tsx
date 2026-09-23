import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Sparkles, ChevronRight, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SkillLevelChip } from "@/components/skill/SkillLevelChip";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";

interface Row {
  self_assessed_level: number | null;
  self_assessed_band: string | null;
}

/**
 * Flashy gold call-to-action that sits at the top of the player's own profile.
 *
 * Not taken yet → shimmering gold panel pushing the assessment.
 * Already taken → same gold treatment, but shows the level and offers the
 * Skill Fingerprint instead.
 */
export function SkillAssessmentCTA({ userId }: { userId?: string }) {
  const navigate = useNavigate();
  const [row, setRow] = useState<Row | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isSkillAssessmentEnabled() || !userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("player_skill_profiles" as never)
        .select("self_assessed_level, self_assessed_band")
        .eq("player_id", userId)
        .maybeSingle();
      if (!cancelled) {
        setRow((data as unknown as Row) ?? null);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!isSkillAssessmentEnabled()) return null;

  const hasResult = loaded && row?.self_assessed_level != null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-4 shadow-[0_8px_28px_-12px_hsl(var(--primary)/0.55)]">
      {/* soft gold sheen */}
      <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-primary/25 blur-3xl" />

      <div className="relative flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[0_4px_14px_-4px_hsl(var(--primary)/0.7)]">
          <Sparkles className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">
            PULSE Skill Assessment
          </p>
          {hasResult ? (
            <>
              <div className="mt-2">
                <SkillLevelChip level={row!.self_assessed_level} band={row!.self_assessed_band} className="max-w-full flex-wrap [&>span]:min-w-0 [&>span]:break-words" />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Your self-assessed level is on your profile. Retake it any time as your game changes.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold leading-snug">
              Explore your game with visual situations and build your Skill Fingerprint.
            </p>
          )}
        </div>
      </div>

      <div data-testid="profile-assessment-actions" className="relative mt-3 min-w-0">
          {hasResult ? (
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => navigate("/player/self-assessment?mode=view")}
                className="h-auto min-h-11 w-full gap-2 whitespace-normal py-2 text-sm font-bold shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.7)]"
              >
                <Gauge className="h-4 w-4" />
                <span className="min-w-0 break-words">View Skill Fingerprint</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate("/player/self-assessment?mode=retake")}
                className="h-auto min-h-10 w-full gap-2 whitespace-normal border-primary/40 py-2 text-sm font-semibold"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="min-w-0 break-words">Retake assessment</span>
              </Button>
            </div>
          ) : (
            <Button
              onClick={() => navigate("/player/self-assessment")}
              className="h-auto min-h-11 w-full gap-2 whitespace-normal py-2 text-sm font-bold shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.7)]"
            >
              <Gauge className="h-4 w-4" />
              <span className="min-w-0 break-words">Take the Skill Assessment</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
      </div>
    </div>
  );
}
