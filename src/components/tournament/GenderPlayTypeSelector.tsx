import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface GenderPlayTypeSelectorProps {
  gender: string;
  playType: string;
  onGenderChange: (value: string) => void;
  onPlayTypeChange: (value: string) => void;
  disabled?: boolean;
}

const GENDER_OPTIONS = [
  { value: "", label: "Open (Any)" },
  { value: "men", label: "Men's" },
  { value: "women", label: "Women's" },
  { value: "mixed", label: "Mixed" },
];

const PLAY_TYPE_OPTIONS = [
  { value: "", label: "Not Specified" },
  { value: "singles", label: "Singles" },
  { value: "doubles", label: "Doubles" },
  { value: "mixed_doubles", label: "Mixed Doubles" },
];

export function GenderPlayTypeSelector({
  gender,
  playType,
  onGenderChange,
  onPlayTypeChange,
  disabled = false,
}: GenderPlayTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>Gender</Label>
        <Select value={gender} onValueChange={onGenderChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select gender" />
          </SelectTrigger>
          <SelectContent>
            {GENDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value || "open"}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Play Type</Label>
        <Select value={playType} onValueChange={onPlayTypeChange} disabled={disabled}>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {PLAY_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value || "any"}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

export function formatGender(gender: string | null): string {
  switch (gender) {
    case "men": return "Men's";
    case "women": return "Women's";
    case "mixed": return "Mixed";
    default: return "Open";
  }
}

export function formatPlayType(playType: string | null): string {
  switch (playType) {
    case "singles": return "Singles";
    case "doubles": return "Doubles";
    case "mixed_doubles": return "Mixed Doubles";
    default: return "";
  }
}
