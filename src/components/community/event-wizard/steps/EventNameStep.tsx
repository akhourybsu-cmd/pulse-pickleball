import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Sparkles } from 'lucide-react';
import { EventWizardFormData, generateDefaultEventTitle } from '../types';

interface EventNameStepProps {
  title: string;
  description: string;
  eventType: EventWizardFormData['eventType'];
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  venueMode?: boolean;
}

export function EventNameStep({
  title,
  description,
  eventType,
  onTitleChange,
  onDescriptionChange,
  venueMode = false,
}: EventNameStepProps) {
  const handleAutoGenerate = () => {
    onTitleChange(generateDefaultEventTitle(eventType));
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">{venueMode ? 'Program details' : 'Name your event'}</h3>
        {venueMode && (
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Use a clear, scannable name. Put what players should expect in the description.
          </p>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Label htmlFor="event-title" className="text-xs font-semibold">Program name</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">{title.length}/80</span>
          </div>
        <div className="flex gap-2">
          <Input
            id="event-title"
            placeholder={venueMode ? 'e.g. 3.5 Evening Open Play' : 'Event name'}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            maxLength={80}
            className="h-11 flex-1 rounded-xl"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-11 w-11 shrink-0 rounded-xl"
            onClick={handleAutoGenerate}
            title="Use a suggested name"
            aria-label="Use a suggested program name"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <Label htmlFor="event-description" className="text-xs font-semibold">What players should know</Label>
            <span className="text-[10px] tabular-nums text-muted-foreground">{description.length}/800</span>
          </div>
        <Textarea
          id="event-description"
          placeholder={venueMode ? 'Rotation, host, check-in notes, and what to bring' : 'Description (optional)'}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          maxLength={800}
          rows={venueMode ? 4 : 2}
          className="resize-none rounded-xl"
        />
        </div>
      </div>
    </div>
  );
}
