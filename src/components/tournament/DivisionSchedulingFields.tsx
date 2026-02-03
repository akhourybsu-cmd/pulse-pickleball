import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface DivisionSchedulingFieldsProps {
  estimatedMatchDuration: string;
  minTeams: string;
  scheduledDay: string;
  scheduledStartTime: string;
  onEstimatedMatchDurationChange: (value: string) => void;
  onMinTeamsChange: (value: string) => void;
  onScheduledDayChange: (value: string) => void;
  onScheduledStartTimeChange: (value: string) => void;
  disabled?: boolean;
  maxDays?: number;
}

const DURATION_OPTIONS = [
  { value: "15", label: "15 minutes" },
  { value: "20", label: "20 minutes" },
  { value: "30", label: "30 minutes (default)" },
  { value: "45", label: "45 minutes" },
  { value: "60", label: "60 minutes" },
];

export function DivisionSchedulingFields({
  estimatedMatchDuration,
  minTeams,
  scheduledDay,
  scheduledStartTime,
  onEstimatedMatchDurationChange,
  onMinTeamsChange,
  onScheduledDayChange,
  onScheduledStartTimeChange,
  disabled = false,
  maxDays = 3,
}: DivisionSchedulingFieldsProps) {
  const dayOptions = Array.from({ length: maxDays }, (_, i) => ({
    value: String(i + 1),
    label: `Day ${i + 1}`,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Match Duration</Label>
          <Select value={estimatedMatchDuration} onValueChange={onEstimatedMatchDurationChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="30 min" />
            </SelectTrigger>
            <SelectContent>
              {DURATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Estimated time per match for scheduling
          </p>
        </div>

        <div className="space-y-2">
          <Label>Minimum Teams</Label>
          <Input
            type="number"
            min="2"
            max="64"
            value={minTeams}
            onChange={(e) => onMinTeamsChange(e.target.value)}
            placeholder="2"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Min teams to run division
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Scheduled Day</Label>
          <Select value={scheduledDay} onValueChange={onScheduledDayChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Day 1" />
            </SelectTrigger>
            <SelectContent>
              {dayOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Start Time</Label>
          <Input
            type="time"
            value={scheduledStartTime}
            onChange={(e) => onScheduledStartTimeChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
