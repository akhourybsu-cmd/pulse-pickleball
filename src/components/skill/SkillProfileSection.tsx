import { useNavigate } from "react-router-dom";
import { Gauge, ChevronRight, Sparkles } from "lucide-react";
import { useSkillProfileSummary } from '@/hooks/useSkillProfileSummary';
import './assessment-brand.css';
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";

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
  const { row, loaded } = useSkillProfileSummary(userId);

  if (!isSkillAssessmentEnabled() || !loaded) return null;

  const hasResult = row?.self_assessed_level != null;

  // Others' profile with nothing to show → render nothing.
  if (!isSelf && !hasResult) return null;

  return (
    <div className="opacity-0 animate-fade-up" style={{ animationDelay: "200ms", animationFillMode: "forwards" }}>
      <SectionHeader label="Skill self-assessment" />

      {hasResult ? (
        <div className="skill-studio skill-profile-card">
          <div className="skill-overline">PULSE skill fingerprint</div>
          <div className="skill-profile-result"><strong>{row!.self_assessed_level!.toFixed(1)}</strong><div><span className="skill-overline">Self-assessed level</span><h2>{row!.self_assessed_band || 'Current estimate'}</h2><p>Based on reported play{row!.provisional_status ? ' · Provisional' : ''}</p></div></div>
          <p className="skill-profile-footnote">Separate from the match-based PULSE Performance Rating.</p>
          {isSelf && (
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/player/self-assessment?mode=view")}>
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
              <Button size="sm" className="mt-3 gap-1.5" onClick={() => navigate("/player/self-assessment?mode=view")}>
                <Gauge className="w-4 h-4" /> Start assessment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
