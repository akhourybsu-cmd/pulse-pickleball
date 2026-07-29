import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gauge, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { SkillLevelChip } from "@/components/skill/SkillLevelChip";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";

interface SkillProfileRow {
  self_assessed_level: number | null;
  self_assessed_band: string | null;
  self_assessment_confidence: number | null;
  provisional_status: boolean | null;
}

/**
 * Player-profile "Skill self-assessment" section. Kept visually and
 * verbally distinct from the PULSE Performance Rating pill above it.
 *
 * On the player's own profile it doubles as the primary entry point (and,
 * when no assessment exists, a lightweight optional prompt they can skip
 * and complete later). Feature-flag gated so it never appears until the
 * assessment surface is enabled. RLS decides whether another player's
 * summary is visible at all.
 */
export function SkillProfileSection({
  userId,
  isSelf,
}: {
  userId: string;
  isSelf: boolean;
}) {
  const navigate = useNavigate();
  const [row, setRow] = useState<SkillProfileRow | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isSkillAssessmentEnabled()) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("player_skill_profiles" as never)
        .select("self_assessed_level, self_assessed_band, self_assessment_confidence, provisional_status")
        .eq("player_id", userId)
        .maybeSingle();
      if (!cancelled) {
        setRow((data as unknown as SkillProfileRow) ?? null);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!isSkillAssessmentEnabled() || !loaded) return null;

  const hasResult = row?.self_assessed_level != null;

  // Others' profile with nothing to show → render nothing.
  if (!isSelf && !hasResult) return null;

  return (
    <div className="opacity-0 animate-fade-up" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
      <SectionHeader label="Skill self-assessment" />

      {hasResult ? (
        <div className="rounded-2xl border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <SkillLevelChip level={row!.self_assessed_level} band={row!.self_assessed_band} />
            {row!.provisional_status && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground rounded-full bg-muted px-2 py-0.5">
                Provisional
              </span>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
            Self-Assessed — separate from the PULSE Performance Rating above.
            {row!.self_assessment_confidence != null && ` Confidence ${row!.self_assessment_confidence}/100.`}
          </p>
          {isSelf && (
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/player/self-assessment")}>
              <Gauge className="w-4 h-4" /> View Skill Fingerprint <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      ) : (
        // Own profile, not taken → optional, skippable prompt.
        <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12 text-primary shrink-0">
              <Sparkles className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Rate your game</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Take the PULSE Skill Assessment to get a Self-Assessed Level and Skill Fingerprint.
                Optional — you can do it any time.
              </p>
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/player/self-assessment")}>
                <Gauge className="w-4 h-4" /> Start assessment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
