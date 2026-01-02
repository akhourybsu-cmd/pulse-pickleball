import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface EventDateTimeStepProps {
  date: string;
  startTime: string;
  endTime: string;
  onDateChange: (date: string) => void;
  onStartTimeChange: (time: string) => void;
  onEndTimeChange: (time: string) => void;
}

export function EventDateTimeStep({
  date,
  startTime,
  endTime,
  onDateChange,
  onStartTimeChange,
  onEndTimeChange,
}: EventDateTimeStepProps) {
  const today = format(new Date(), 'yyyy-MM-dd');

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">When is it?</h3>
      
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground mb-1 block">Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            min={today}
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Start time</Label>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">End time (optional)</Label>
            <Input
              type="time"
              value={endTime}
              onChange={(e) => onEndTimeChange(e.target.value)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
