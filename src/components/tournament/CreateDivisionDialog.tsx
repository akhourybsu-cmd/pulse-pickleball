import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { SkillLevelSelector } from "./SkillLevelSelector";
import { AgeGroupSelector } from "./AgeGroupSelector";
import { GenderPlayTypeSelector } from "./GenderPlayTypeSelector";
import { DivisionPricingFields } from "./DivisionPricingFields";
import { DivisionSchedulingFields } from "./DivisionSchedulingFields";

const divisionSchema = z.object({
  name: z.string().min(1, "Division name is required"),
  description: z.string().optional(),
  format: z.enum(["round_robin", "single_elimination", "double_elimination", "pool_play"]),
  scoring_ruleset_id: z.string().uuid("Please select a scoring ruleset"),
  max_teams: z.number().int().min(2, "Minimum 2 teams").max(64, "Maximum 64 teams").optional(),
  // New fields
  skill_level_min: z.string().optional(),
  skill_level_max: z.string().optional(),
  age_group: z.string().optional(),
  age_min: z.string().optional(),
  age_max: z.string().optional(),
  gender: z.string().optional(),
  play_type: z.string().optional(),
  registration_fee: z.string().optional(),
  early_bird_fee: z.string().optional(),
  early_bird_deadline: z.date().optional(),
  estimated_match_duration: z.string().optional(),
  min_teams: z.string().optional(),
  scheduled_day: z.string().optional(),
  scheduled_start_time: z.string().optional(),
});

type DivisionFormData = z.infer<typeof divisionSchema>;

interface ScoringRuleset {
  id: string;
  name: string;
  description: string | null;
  games_to: number;
  win_by_2: boolean;
  best_of: number;
}

interface CreateDivisionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  onSuccess: () => void;
}

export function CreateDivisionDialog({ open, onOpenChange, eventId, onSuccess }: CreateDivisionDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [rulesets, setRulesets] = useState<ScoringRuleset[]>([]);
  const [activeTab, setActiveTab] = useState("basic");

  const form = useForm<DivisionFormData>({
    resolver: zodResolver(divisionSchema),
    defaultValues: {
      name: "",
      description: "",
      format: "round_robin",
      scoring_ruleset_id: "",
      skill_level_min: "",
      skill_level_max: "",
      age_group: "",
      age_min: "",
      age_max: "",
      gender: "",
      play_type: "",
      registration_fee: "",
      early_bird_fee: "",
      estimated_match_duration: "30",
      min_teams: "2",
      scheduled_day: "1",
      scheduled_start_time: "",
    },
  });

  const loadRulesets = async () => {
    const { data, error } = await supabase
      .from("tournaments_scoring_rulesets")
      .select("*")
      .order("name");

    if (error) {
      toast({
        title: "Error loading scoring rulesets",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setRulesets(data || []);
    }
  };

  useEffect(() => {
    if (open) {
      loadRulesets();
      form.reset();
      setActiveTab("basic");
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const onSubmit = async (data: DivisionFormData) => {
    setLoading(true);
    
    // Parse numeric values
    const skillMin = data.skill_level_min && data.skill_level_min !== "any" 
      ? parseFloat(data.skill_level_min) 
      : null;
    const skillMax = data.skill_level_max && data.skill_level_max !== "any" 
      ? parseFloat(data.skill_level_max) 
      : null;
    const ageMin = data.age_min ? parseInt(data.age_min) : null;
    const ageMax = data.age_max ? parseInt(data.age_max) : null;
    const regFee = data.registration_fee ? parseFloat(data.registration_fee) : null;
    const earlyFee = data.early_bird_fee ? parseFloat(data.early_bird_fee) : null;
    const matchDuration = data.estimated_match_duration ? parseInt(data.estimated_match_duration) : 30;
    const minTeams = data.min_teams ? parseInt(data.min_teams) : 2;
    const scheduledDay = data.scheduled_day ? parseInt(data.scheduled_day) : 1;

    const { error } = await supabase.from("tournaments_divisions").insert({
      event_id: eventId,
      name: data.name,
      description: data.description || null,
      format: data.format,
      scoring_ruleset_id: data.scoring_ruleset_id,
      max_teams: data.max_teams || null,
      // New fields
      skill_level_min: skillMin,
      skill_level_max: skillMax,
      age_group: data.age_group && data.age_group !== "open" ? data.age_group : null,
      age_min: ageMin,
      age_max: ageMax,
      gender: data.gender && data.gender !== "open" ? data.gender : null,
      play_type: data.play_type && data.play_type !== "any" ? data.play_type : null,
      registration_fee: regFee,
      early_bird_fee: earlyFee,
      early_bird_deadline: data.early_bird_deadline?.toISOString() || null,
      estimated_match_duration: matchDuration,
      min_teams: minTeams,
      scheduled_day: scheduledDay,
      scheduled_start_time: data.scheduled_start_time || null,
    });

    if (error) {
      toast({
        title: "Error creating division",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Division created",
        description: `${data.name} has been added to the event`,
      });
      onSuccess();
      handleOpenChange(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Division</DialogTitle>
          <DialogDescription>
            Add a new division to this tournament event
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic</TabsTrigger>
                <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
                <TabsTrigger value="pricing">Pricing</TabsTrigger>
                <TabsTrigger value="scheduling">Scheduling</TabsTrigger>
              </TabsList>

              <TabsContent value="basic" className="space-y-4 mt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Division Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Men's 4.0, Women's Open" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Division details, requirements, etc."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="format"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Format *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="round_robin">Round Robin</SelectItem>
                          <SelectItem value="single_elimination">Single Elimination</SelectItem>
                          <SelectItem value="double_elimination">Double Elimination</SelectItem>
                          <SelectItem value="pool_play">Pool Play</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scoring_ruleset_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Scoring Ruleset *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select scoring rules" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {rulesets.map((ruleset) => (
                            <SelectItem key={ruleset.id} value={ruleset.id}>
                              {ruleset.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="max_teams"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Teams</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Leave empty for unlimited"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="eligibility" className="space-y-6 mt-4">
                <GenderPlayTypeSelector
                  gender={form.watch("gender") || ""}
                  playType={form.watch("play_type") || ""}
                  onGenderChange={(val) => form.setValue("gender", val)}
                  onPlayTypeChange={(val) => form.setValue("play_type", val)}
                />

                <SkillLevelSelector
                  minValue={form.watch("skill_level_min") || ""}
                  maxValue={form.watch("skill_level_max") || ""}
                  onMinChange={(val) => form.setValue("skill_level_min", val)}
                  onMaxChange={(val) => form.setValue("skill_level_max", val)}
                />

                <AgeGroupSelector
                  ageGroup={form.watch("age_group") || ""}
                  ageMin={form.watch("age_min") || ""}
                  ageMax={form.watch("age_max") || ""}
                  onAgeGroupChange={(val) => form.setValue("age_group", val)}
                  onAgeMinChange={(val) => form.setValue("age_min", val)}
                  onAgeMaxChange={(val) => form.setValue("age_max", val)}
                />
              </TabsContent>

              <TabsContent value="pricing" className="mt-4">
                <DivisionPricingFields
                  registrationFee={form.watch("registration_fee") || ""}
                  earlyBirdFee={form.watch("early_bird_fee") || ""}
                  earlyBirdDeadline={form.watch("early_bird_deadline")}
                  onRegistrationFeeChange={(val) => form.setValue("registration_fee", val)}
                  onEarlyBirdFeeChange={(val) => form.setValue("early_bird_fee", val)}
                  onEarlyBirdDeadlineChange={(date) => form.setValue("early_bird_deadline", date)}
                />
              </TabsContent>

              <TabsContent value="scheduling" className="mt-4">
                <DivisionSchedulingFields
                  estimatedMatchDuration={form.watch("estimated_match_duration") || "30"}
                  minTeams={form.watch("min_teams") || "2"}
                  scheduledDay={form.watch("scheduled_day") || "1"}
                  scheduledStartTime={form.watch("scheduled_start_time") || ""}
                  onEstimatedMatchDurationChange={(val) => form.setValue("estimated_match_duration", val)}
                  onMinTeamsChange={(val) => form.setValue("min_teams", val)}
                  onScheduledDayChange={(val) => form.setValue("scheduled_day", val)}
                  onScheduledStartTimeChange={(val) => form.setValue("scheduled_start_time", val)}
                />
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Division
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
