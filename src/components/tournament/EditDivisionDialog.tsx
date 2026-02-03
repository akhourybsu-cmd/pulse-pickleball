import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { SkillLevelSelector } from "./SkillLevelSelector";
import { AgeGroupSelector } from "./AgeGroupSelector";
import { GenderPlayTypeSelector } from "./GenderPlayTypeSelector";
import { DivisionPricingFields } from "./DivisionPricingFields";
import { DivisionSchedulingFields } from "./DivisionSchedulingFields";

interface Division {
  id: string;
  name: string;
  description: string | null;
  max_teams: number | null;
  scoring_ruleset_id: string | null;
  status: string;
  format?: string;
  skill_level_min?: number | null;
  skill_level_max?: number | null;
  age_group?: string | null;
  age_min?: number | null;
  age_max?: number | null;
  gender?: string | null;
  play_type?: string | null;
  registration_fee?: number | null;
  early_bird_fee?: number | null;
  early_bird_deadline?: string | null;
  estimated_match_duration?: number | null;
  min_teams?: number | null;
  scheduled_day?: number | null;
  scheduled_start_time?: string | null;
}

interface ScoringRuleset {
  id: string;
  name: string;
}

interface EditDivisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  division: Division;
  onSave: (updates: Partial<Division>) => Promise<void>;
}

export function EditDivisionDialog({
  open,
  onOpenChange,
  division,
  onSave,
}: EditDivisionDialogProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("basic");
  
  // Basic fields
  const [name, setName] = useState(division.name);
  const [description, setDescription] = useState(division.description || "");
  const [maxTeams, setMaxTeams] = useState(division.max_teams?.toString() || "");
  const [scoringRulesetId, setScoringRulesetId] = useState(division.scoring_ruleset_id || "");
  const [status, setStatus] = useState(division.status);
  const [format, setFormat] = useState(division.format || "round_robin");
  
  // Eligibility fields
  const [skillLevelMin, setSkillLevelMin] = useState(division.skill_level_min?.toString() || "");
  const [skillLevelMax, setSkillLevelMax] = useState(division.skill_level_max?.toString() || "");
  const [ageGroup, setAgeGroup] = useState(division.age_group || "");
  const [ageMin, setAgeMin] = useState(division.age_min?.toString() || "");
  const [ageMax, setAgeMax] = useState(division.age_max?.toString() || "");
  const [gender, setGender] = useState(division.gender || "");
  const [playType, setPlayType] = useState(division.play_type || "");
  
  // Pricing fields
  const [registrationFee, setRegistrationFee] = useState(division.registration_fee?.toString() || "");
  const [earlyBirdFee, setEarlyBirdFee] = useState(division.early_bird_fee?.toString() || "");
  const [earlyBirdDeadline, setEarlyBirdDeadline] = useState<Date | undefined>(
    division.early_bird_deadline ? new Date(division.early_bird_deadline) : undefined
  );
  
  // Scheduling fields
  const [estimatedMatchDuration, setEstimatedMatchDuration] = useState(
    division.estimated_match_duration?.toString() || "30"
  );
  const [minTeams, setMinTeams] = useState(division.min_teams?.toString() || "2");
  const [scheduledDay, setScheduledDay] = useState(division.scheduled_day?.toString() || "1");
  const [scheduledStartTime, setScheduledStartTime] = useState(division.scheduled_start_time || "");
  
  const [rulesets, setRulesets] = useState<ScoringRuleset[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMatches, setHasMatches] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset all fields
      setName(division.name);
      setDescription(division.description || "");
      setMaxTeams(division.max_teams?.toString() || "");
      setScoringRulesetId(division.scoring_ruleset_id || "");
      setStatus(division.status);
      setFormat(division.format || "round_robin");
      setSkillLevelMin(division.skill_level_min?.toString() || "");
      setSkillLevelMax(division.skill_level_max?.toString() || "");
      setAgeGroup(division.age_group || "");
      setAgeMin(division.age_min?.toString() || "");
      setAgeMax(division.age_max?.toString() || "");
      setGender(division.gender || "");
      setPlayType(division.play_type || "");
      setRegistrationFee(division.registration_fee?.toString() || "");
      setEarlyBirdFee(division.early_bird_fee?.toString() || "");
      setEarlyBirdDeadline(
        division.early_bird_deadline ? new Date(division.early_bird_deadline) : undefined
      );
      setEstimatedMatchDuration(division.estimated_match_duration?.toString() || "30");
      setMinTeams(division.min_teams?.toString() || "2");
      setScheduledDay(division.scheduled_day?.toString() || "1");
      setScheduledStartTime(division.scheduled_start_time || "");
      setActiveTab("basic");
      fetchRulesets();
      checkMatches();
    }
  }, [open, division]);

  const checkMatches = async () => {
    const { count } = await supabase
      .from("tournaments_matches")
      .select("*", { count: "exact", head: true })
      .eq("division_id", division.id);
    setHasMatches((count || 0) > 0);
  };

  const fetchRulesets = async () => {
    const { data } = await supabase
      .from("tournaments_scoring_rulesets")
      .select("id, name")
      .order("name");
    
    if (data) setRulesets(data);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation error",
        description: "Division name is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const updates: Partial<Division> = {
      name: name.trim(),
      description: description.trim() || null,
      max_teams: maxTeams ? parseInt(maxTeams) : null,
      scoring_ruleset_id: scoringRulesetId || null,
      status: status as any,
      format: format,
      // Eligibility
      skill_level_min: skillLevelMin && skillLevelMin !== "any" ? parseFloat(skillLevelMin) : null,
      skill_level_max: skillLevelMax && skillLevelMax !== "any" ? parseFloat(skillLevelMax) : null,
      age_group: ageGroup && ageGroup !== "open" ? ageGroup : null,
      age_min: ageMin ? parseInt(ageMin) : null,
      age_max: ageMax ? parseInt(ageMax) : null,
      gender: gender && gender !== "open" ? gender : null,
      play_type: playType && playType !== "any" ? playType : null,
      // Pricing
      registration_fee: registrationFee ? parseFloat(registrationFee) : null,
      early_bird_fee: earlyBirdFee ? parseFloat(earlyBirdFee) : null,
      early_bird_deadline: earlyBirdDeadline?.toISOString() || null,
      // Scheduling
      estimated_match_duration: estimatedMatchDuration ? parseInt(estimatedMatchDuration) : 30,
      min_teams: minTeams ? parseInt(minTeams) : 2,
      scheduled_day: scheduledDay ? parseInt(scheduledDay) : 1,
      scheduled_start_time: scheduledStartTime || null,
    };

    try {
      await onSave(updates);
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Division</DialogTitle>
          <DialogDescription>
            Update division settings and configuration
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
            <TabsTrigger value="pricing">Pricing</TabsTrigger>
            <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
          </TabsList>

          <TabsContent value="basic" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="name">Division Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Men's Open, Women's 3.5"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional division details"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Format</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="round_robin">Round Robin</SelectItem>
                  <SelectItem value="single_elimination">Single Elimination</SelectItem>
                  <SelectItem value="double_elimination">Double Elimination</SelectItem>
                  <SelectItem value="pool_play">Pool Play</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTeams">Max Teams</Label>
              <Input
                id="maxTeams"
                type="number"
                min="2"
                value={maxTeams}
                onChange={(e) => setMaxTeams(e.target.value)}
                placeholder="Optional team limit"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ruleset">Scoring Ruleset</Label>
              <Select value={scoringRulesetId} onValueChange={setScoringRulesetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scoring rules" />
                </SelectTrigger>
                <SelectContent>
                  {rulesets.map((ruleset) => (
                    <SelectItem key={ruleset.id} value={ruleset.id}>
                      {ruleset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Division Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed" disabled={!hasMatches}>Completed</SelectItem>
                </SelectContent>
              </Select>
              {status === "draft" && hasMatches && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Warning: Setting to draft will prevent match generation
                  </AlertDescription>
                </Alert>
              )}
              {status === "completed" && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    Completing a division prevents further edits to matches
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          <TabsContent value="eligibility" className="space-y-6 mt-4">
            <GenderPlayTypeSelector
              gender={gender}
              playType={playType}
              onGenderChange={setGender}
              onPlayTypeChange={setPlayType}
            />

            <SkillLevelSelector
              minValue={skillLevelMin}
              maxValue={skillLevelMax}
              onMinChange={setSkillLevelMin}
              onMaxChange={setSkillLevelMax}
            />

            <AgeGroupSelector
              ageGroup={ageGroup}
              ageMin={ageMin}
              ageMax={ageMax}
              onAgeGroupChange={setAgeGroup}
              onAgeMinChange={setAgeMin}
              onAgeMaxChange={setAgeMax}
            />
          </TabsContent>

          <TabsContent value="pricing" className="mt-4">
            <DivisionPricingFields
              registrationFee={registrationFee}
              earlyBirdFee={earlyBirdFee}
              earlyBirdDeadline={earlyBirdDeadline}
              onRegistrationFeeChange={setRegistrationFee}
              onEarlyBirdFeeChange={setEarlyBirdFee}
              onEarlyBirdDeadlineChange={setEarlyBirdDeadline}
            />
          </TabsContent>

          <TabsContent value="scheduling" className="mt-4">
            <DivisionSchedulingFields
              estimatedMatchDuration={estimatedMatchDuration}
              minTeams={minTeams}
              scheduledDay={scheduledDay}
              scheduledStartTime={scheduledStartTime}
              onEstimatedMatchDurationChange={setEstimatedMatchDuration}
              onMinTeamsChange={setMinTeams}
              onScheduledDayChange={setScheduledDay}
              onScheduledStartTimeChange={setScheduledStartTime}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
