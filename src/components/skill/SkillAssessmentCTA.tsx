import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, Sparkles, ChevronRight } from "lucide-react";
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
                <SkillLevelChip level={row!.self_assessed_level} band={row!.self_assessed_band} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Your self-assessed level is on your profile. Retake it any time as your game changes.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm font-semibold leading-snug">
              Rate your game in 2 minutes — add your Skill Level to your profile.
            </p>
          )}

          <Button
            onClick={() => navigate("/player/self-assessment")}
            className="mt-3 h-11 w-full gap-2 text-sm font-bold shadow-[0_6px_20px_-6px_hsl(var(--primary)/0.7)]"
          >
            <Gauge className="h-4 w-4" />
            {hasResult ? "View Skill Fingerprint" : "Take the Skill Assessment"}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
