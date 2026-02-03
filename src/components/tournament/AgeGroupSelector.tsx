import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface AgeGroupSelectorProps {
  ageGroup: string;
  ageMin: string;
  ageMax: string;
  onAgeGroupChange: (value: string) => void;
  onAgeMinChange: (value: string) => void;
  onAgeMaxChange: (value: string) => void;
  disabled?: boolean;
}

const AGE_GROUPS = [
  { value: "", label: "Open (All Ages)" },
  { value: "junior", label: "Junior (Under 19)" },
  { value: "adult", label: "Adult (19+)" },
  { value: "senior", label: "Senior (50+)" },
  { value: "custom", label: "Custom Range" },
];

const AGE_PRESETS: Record<string, { min: string; max: string }> = {
  "": { min: "", max: "" },
  junior: { min: "", max: "18" },
  adult: { min: "19", max: "" },
  senior: { min: "50", max: "" },
  custom: { min: "", max: "" },
};

export function AgeGroupSelector({
  ageGroup,
  ageMin,
  ageMax,
  onAgeGroupChange,
  onAgeMinChange,
  onAgeMaxChange,
  disabled = false,
}: AgeGroupSelectorProps) {
  const handleAgeGroupChange = (value: string) => {
    onAgeGroupChange(value);
    const preset = AGE_PRESETS[value];
    if (preset && value !== "custom") {
      onAgeMinChange(preset.min);
      onAgeMaxChange(preset.max);
    }
  };

  const showCustomInputs = ageGroup === "custom" || ageGroup === "senior";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Age Group</Label>
        <Select value={ageGroup} onValueChange={handleAgeGroupChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select age group" />
          </SelectTrigger>
          <SelectContent>
            {AGE_GROUPS.map((group) => (
              <SelectItem key={group.value} value={group.value || "open"}>
                {group.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCustomInputs && (
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Label className="text-xs">Min Age</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={ageMin}
              onChange={(e) => onAgeMinChange(e.target.value)}
              placeholder="e.g., 50"
              disabled={disabled}
            />
          </div>
          <span className="text-muted-foreground mt-5">to</span>
          <div className="flex-1">
            <Label className="text-xs">Max Age</Label>
            <Input
              type="number"
              min="1"
              max="100"
              value={ageMax}
              onChange={(e) => onAgeMaxChange(e.target.value)}
              placeholder="None"
              disabled={disabled}
            />
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Age is typically determined as of Dec 31 of the tournament year
      </p>
    </div>
  );
}

export function formatAgeGroup(ageGroup: string | null, ageMin: number | null, ageMax: number | null): string {
  if (ageGroup === "junior") return "Junior";
  if (ageGroup === "adult") return "Adult";
  if (ageGroup === "senior" && ageMin) return `${ageMin}+`;
  if (ageMin && ageMax) return `${ageMin}-${ageMax}`;
  if (ageMin) return `${ageMin}+`;
  if (ageMax) return `Under ${ageMax}`;
  return "Open";
}
