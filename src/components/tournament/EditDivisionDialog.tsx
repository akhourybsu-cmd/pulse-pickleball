import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Division {
  id: string;
  name: string;
  description: string | null;
  max_teams: number | null;
  scoring_ruleset_id: string | null;
  status: string;
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
  const [name, setName] = useState(division.name);
  const [description, setDescription] = useState(division.description || "");
  const [maxTeams, setMaxTeams] = useState(division.max_teams?.toString() || "");
  const [scoringRulesetId, setScoringRulesetId] = useState(division.scoring_ruleset_id || "");
  const [status, setStatus] = useState(division.status);
  const [rulesets, setRulesets] = useState<ScoringRuleset[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMatches, setHasMatches] = useState(false);

  useEffect(() => {
    if (open) {
      setName(division.name);
      setDescription(division.description || "");
      setMaxTeams(division.max_teams?.toString() || "");
      setScoringRulesetId(division.scoring_ruleset_id || "");
      setStatus(division.status);
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

  const hasChanges =
    name !== division.name ||
    description !== (division.description || "") ||
    maxTeams !== (division.max_teams?.toString() || "") ||
    scoringRulesetId !== (division.scoring_ruleset_id || "") ||
    status !== division.status;

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Division</DialogTitle>
          <DialogDescription>
            Update division settings and status
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={!hasChanges || loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
