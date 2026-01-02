import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Users } from 'lucide-react';

interface EventDetailsStepProps {
  location: string;
  capacity: number | null;
  onLocationChange: (location: string) => void;
  onCapacityChange: (capacity: number | null) => void;
}

export function EventDetailsStep({
  location,
  capacity,
  onLocationChange,
  onCapacityChange,
}: EventDetailsStepProps) {
  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Additional details</h3>
      <p className="text-sm text-muted-foreground">These are optional</p>
      
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> Location
          </Label>
          <Input
            placeholder="Where will this happen?"
            value={location}
            onChange={(e) => onLocationChange(e.target.value)}
          />
        </div>
        
        <div>
          <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Users className="h-3 w-3" /> Capacity
          </Label>
          <Input
            type="number"
            placeholder="Max participants (leave empty for unlimited)"
            value={capacity ?? ''}
            onChange={(e) => onCapacityChange(e.target.value ? parseInt(e.target.value) : null)}
            min={1}
          />
        </div>
      </div>
    </div>
  );
}
