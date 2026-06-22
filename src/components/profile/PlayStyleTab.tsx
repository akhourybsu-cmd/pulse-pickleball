import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlayStyleTabProps {
  formData: {
    handedness: string | null;
    play_side: string | null;
  };
  onFormChange: (updates: Partial<PlayStyleTabProps['formData']>) => void;
}

export function PlayStyleTab({ formData, onFormChange }: PlayStyleTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="handedness">Handedness</Label>
          <Select
            value={formData.handedness || ""}
            onValueChange={(value) => onFormChange({ handedness: value })}
          >
            <SelectTrigger id="handedness">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="right">Right-Handed</SelectItem>
              <SelectItem value="left">Left-Handed</SelectItem>
              <SelectItem value="ambidextrous">Ambidextrous</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="play_side">Play Side</Label>
          <Select
            value={formData.play_side || ""}
            onValueChange={(value) => onFormChange({ play_side: value })}
          >
            <SelectTrigger id="play_side">
              <SelectValue placeholder="Select..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="forehand">Forehand Side</SelectItem>
              <SelectItem value="backhand">Backhand Side</SelectItem>
              <SelectItem value="either">Either Side</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
