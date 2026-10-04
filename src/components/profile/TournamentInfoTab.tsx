import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { differenceInYears } from "date-fns";

interface TournamentInfoTabProps {
  formData: {
    phone_number: string | null;
    date_of_birth: string | null;
    gender: string | null;
    skill_level_self: string | null;
  };
  onFormChange: (updates: Partial<TournamentInfoTabProps['formData']>) => void;
}

export function TournamentInfoTab({ formData, onFormChange }: TournamentInfoTabProps) {
  const age = formData.date_of_birth
    ? differenceInYears(new Date(), new Date(formData.date_of_birth))
    : null;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phone_number">Phone number (optional)</Label>
        <Input
          id="phone_number"
          type="tel"
          value={formData.phone_number || ""}
          onChange={(e) => onFormChange({ phone_number: e.target.value })}
          placeholder="(555) 123-4567"
        />
        <p className="text-xs text-muted-foreground">Add a contact number for your player profile.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="date_of_birth">Date of Birth</Label>
          <Input
            id="date_of_birth"
            type="date"
            max={new Date().toISOString().slice(0, 10)}
            value={formData.date_of_birth || ""}
            onChange={(e) => onFormChange({ date_of_birth: e.target.value })}
          />
          {age !== null && (
            <p className="text-xs text-muted-foreground">Age: {age} years old</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <Select
            value={formData.gender || ""}
            onValueChange={(value) => onFormChange({ gender: value })}
          >
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="non_binary">Non-Binary</SelectItem>
              <SelectItem value="prefer_not_to_say">Prefer Not to Say</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill_level_self">Self-Assessed Skill Level</Label>
        <Select
          value={formData.skill_level_self || ""}
          onValueChange={(value) => onFormChange({ skill_level_self: value })}
        >
          <SelectTrigger id="skill_level_self">
            <SelectValue placeholder="Select your skill level..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="beginner">Beginner (2.0-2.5)</SelectItem>
            <SelectItem value="intermediate">Intermediate (3.0-3.5)</SelectItem>
            <SelectItem value="advanced">Advanced (4.0-4.5)</SelectItem>
            <SelectItem value="semi_pro">Semi-Pro (5.0)</SelectItem>
            <SelectItem value="pro">Pro (5.5+)</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Your estimate of your playing level; separate from your match-based PULSE rating.</p>
      </div>
    </div>
  );
}
