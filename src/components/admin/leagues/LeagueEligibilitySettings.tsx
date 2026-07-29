import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ShieldCheck, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormRow, FIELD_H, SegmentedControl } from "./_shared";
import { cn } from "@/lib/utils";
import type { League } from "@/lib/leagues/types";
import { isSkillAssessmentEnabled } from "@/lib/skill/featureFlag";
import { DEFAULT_ELIGIBILITY, type LeagueSkillEligibility, type ProvisionalPolicy, type SkillSource } from "@/lib/skill/eligibility";

/**
 * Organizer configuration for optional skill eligibility (PULSE Skill
 * Assessment). Self-contained (own fetch/save against
 * league_skill_eligibility) — it does not participate in the OverviewTab
 * dirty/save flow. Feature-flagged. This is an INACTIVE FOUNDATION: nothing
 * here enforces eligibility on join/generation yet, and the card says so.
 */

const SOURCES: { key: SkillSource; label: string }[] = [
  { key: "self", label: "Self-assessed" },
  { key: "observed", label: "Observed" },
  { key: "performance", label: "Performance" },
];

interface Row {
  enabled: boolean;
  min_level: number | null;
  max_level: number | null;
  accepted_sources: string[];
  accept_self_assessment: boolean;
  min_confidence: number;
  allow_organizer_approval: boolean;
  allow_playing_up: boolean;
  allow_playing_down: boolean;
  provisional_policy: ProvisionalPolicy;
}

function toState(r: Row | null): LeagueSkillEligibility {
  if (!r) return { ...DEFAULT_ELIGIBILITY };
  return {
    enabled: r.enabled,
    minLevel: r.min_level,
    maxLevel: r.max_level,
    acceptedSources: (r.accepted_sources as SkillSource[]) ?? ["self"],
    acceptSelfAssessment: r.accept_self_assessment,
    minConfidence: r.min_confidence,
    allowOrganizerApproval: r.allow_organizer_approval,
    allowPlayingUp: r.allow_playing_up,
    allowPlayingDown: r.allow_playing_down,
    provisionalPolicy: r.provisional_policy,
  };
}

export function LeagueEligibilitySettings({ league }: { league: League }) {
  const [s, setS] = useState<LeagueSkillEligibility>(DEFAULT_ELIGIBILITY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isSkillAssessmentEnabled()) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("league_skill_eligibility" as never)
        .select("*").eq("league_id", league.id).maybeSingle();
      if (!cancelled) { setS(toState((data as unknown as Row) ?? null)); setLoaded(true); }
    })();
    return () => { cancelled = true; };
  }, [league.id]);

  if (!isSkillAssessmentEnabled() || !loaded) return null;

  const set = <K extends keyof LeagueSkillEligibility>(k: K, v: LeagueSkillEligibility[K]) =>
    setS((prev) => ({ ...prev, [k]: v }));

  const toggleSource = (src: SkillSource) =>
    setS((prev) => ({
      ...prev,
      acceptedSources: prev.acceptedSources.includes(src)
        ? prev.acceptedSources.filter((x) => x !== src)
        : [...prev.acceptedSources, src],
    }));

  const numOrNull = (v: string): number | null => (v.trim() === "" ? null : Number(v));

  const save = async () => {
    if (s.minLevel != null && s.maxLevel != null && s.maxLevel < s.minLevel) {
      toast.error("Max level can't be below min level"); return;
    }
    setSaving(true);
    const { error } = await supabase.from("league_skill_eligibility" as never).upsert({
      league_id: league.id,
      enabled: s.enabled,
      min_level: s.minLevel,
      max_level: s.maxLevel,
      accepted_sources: s.acceptedSources.length ? s.acceptedSources : ["self"],
      accept_self_assessment: s.acceptSelfAssessment,
      min_confidence: s.minConfidence,
      allow_organizer_approval: s.allowOrganizerApproval,
      allow_playing_up: s.allowPlayingUp,
      allow_playing_down: s.allowPlayingDown,
      provisional_policy: s.provisionalPolicy,
    } as never, { onConflict: "league_id" } as never);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Eligibility settings saved");
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Skill eligibility</h3>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        Preview — these rules are saved but <strong>not enforced yet</strong>. Enforcement on
        join and substitute matching arrives in a later update. Uses the PULSE Self-Assessed
        Level, kept separate from the Performance Rating.
      </div>

      <label className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Use skill eligibility for this league</span>
        <Switch checked={s.enabled} onCheckedChange={(v) => set("enabled", v)} />
      </label>

      <div className={cn("space-y-4 transition-opacity", !s.enabled && "opacity-50 pointer-events-none")}>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Min level"><Input type="number" step="0.1" min="1" max="6" className={FIELD_H}
            value={s.minLevel ?? ""} onChange={(e) => set("minLevel", numOrNull(e.target.value))} /></FormRow>
          <FormRow label="Max level"><Input type="number" step="0.1" min="1" max="6" className={FIELD_H}
            value={s.maxLevel ?? ""} onChange={(e) => set("maxLevel", numOrNull(e.target.value))} /></FormRow>
        </div>

        <FormRow label="Accepted sources" hint="Which measurements count toward eligibility.">
          <div className="flex flex-wrap gap-1.5">
            {SOURCES.map((src) => (
              <button key={src.key} type="button" onClick={() => toggleSource(src.key)}
                aria-pressed={s.acceptedSources.includes(src.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                  s.acceptedSources.includes(src.key) ? "border-primary bg-primary/10 text-primary" : "border-border/70 hover:bg-muted/50",
                )}>
                {src.label}
              </button>
            ))}
          </div>
        </FormRow>

        <FormRow label="Minimum assessment confidence" hint="0–100. Below this, organizer review is suggested.">
          <Input type="number" min="0" max="100" className={FIELD_H}
            value={s.minConfidence} onChange={(e) => set("minConfidence", Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
        </FormRow>

        <FormRow label="Provisional players">
          <SegmentedControl<ProvisionalPolicy>
            value={s.provisionalPolicy}
            onChange={(v) => set("provisionalPolicy", v)}
            options={[
              { value: "allow", label: "Allow" },
              { value: "require_review", label: "Review" },
              { value: "block", label: "Block" },
            ]}
          />
        </FormRow>

        <div className="space-y-2.5">
          <ToggleRow label="Accept self-assessments" checked={s.acceptSelfAssessment} onChange={(v) => set("acceptSelfAssessment", v)} />
          <ToggleRow label="Allow organizer approval" checked={s.allowOrganizerApproval} onChange={(v) => set("allowOrganizerApproval", v)} />
          <ToggleRow label="Allow playing up (below min, with approval)" checked={s.allowPlayingUp} onChange={(v) => set("allowPlayingUp", v)} />
          <ToggleRow label="Allow playing down (above max)" checked={s.allowPlayingDown} onChange={(v) => set("allowPlayingDown", v)} />
        </div>
      </div>

      <Button onClick={save} disabled={saving} className="h-10">
        {saving ? "Saving…" : "Save eligibility settings"}
      </Button>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
