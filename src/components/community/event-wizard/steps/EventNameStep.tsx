import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
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
      
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder={venueMode ? 'e.g. 3.5 Evening Open Play' : 'Event name'}
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleAutoGenerate}
            title="Auto-generate name"
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </div>
        
        <Textarea
          placeholder={venueMode ? 'Rotation, host, check-in notes, and what to bring' : 'Description (optional)'}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={venueMode ? 4 : 2}
          className="resize-none"
        />
      </div>
    </div>
  );
}
