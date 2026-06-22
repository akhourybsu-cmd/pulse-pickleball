import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface PlayStyleTabProps {
  formData: {
    home_court_id: string | null;
    handedness: string | null;
    play_side: string | null;
  };
  onFormChange: (updates: Partial<PlayStyleTabProps['formData']>) => void;
  courts: Court[];
}

export function PlayStyleTab({ formData, onFormChange, courts }: PlayStyleTabProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="home_court">Home Court</Label>
        <Select
          value={formData.home_court_id || ""}
          onValueChange={(value) => onFormChange({ home_court_id: value })}
        >
          <SelectTrigger id="home_court">
            <SelectValue placeholder="Select your home court" />
          </SelectTrigger>
          <SelectContent>
            {courts.map((court) => (
              <SelectItem key={court.id} value={court.id}>
                {court.name} — {court.city}, {court.state}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Connects you to your local community</p>
      </div>

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
