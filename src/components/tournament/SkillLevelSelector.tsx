import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SkillLevelSelectorProps {
  minValue: string;
  maxValue: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  disabled?: boolean;
}

const SKILL_LEVELS = [
  { value: "", label: "Any" },
  { value: "2.0", label: "2.0" },
  { value: "2.5", label: "2.5" },
  { value: "3.0", label: "3.0" },
  { value: "3.5", label: "3.5" },
  { value: "4.0", label: "4.0" },
  { value: "4.5", label: "4.5" },
  { value: "5.0", label: "5.0" },
  { value: "5.5", label: "5.5+" },
];

export function SkillLevelSelector({
  minValue,
  maxValue,
  onMinChange,
  onMaxChange,
  disabled = false,
}: SkillLevelSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Skill Level Range</Label>
      <div className="flex items-center gap-2">
        <Select value={minValue} onValueChange={onMinChange} disabled={disabled}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent>
            {SKILL_LEVELS.map((level) => (
              <SelectItem key={`min-${level.value}`} value={level.value || "any"}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">to</span>
        <Select value={maxValue} onValueChange={onMaxChange} disabled={disabled}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Max" />
          </SelectTrigger>
          <SelectContent>
            {SKILL_LEVELS.map((level) => (
              <SelectItem key={`max-${level.value}`} value={level.value || "any"}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Set skill level requirements for this division (USAP/DUPR rating)
      </p>
    </div>
  );
}

export function formatSkillLevel(min: number | null, max: number | null): string {
  if (!min && !max) return "Open";
  if (min && max && min === max) return min.toFixed(1);
  if (min && max) return `${min.toFixed(1)} - ${max.toFixed(1)}`;
  if (min) return `${min.toFixed(1)}+`;
  if (max) return `≤${max.toFixed(1)}`;
  return "Open";
}
