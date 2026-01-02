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
}

export function EventNameStep({
  title,
  description,
  eventType,
  onTitleChange,
  onDescriptionChange,
}: EventNameStepProps) {
  const handleAutoGenerate = () => {
    onTitleChange(generateDefaultEventTitle(eventType));
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Name your event</h3>
      
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="Event name"
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
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          rows={2}
          className="resize-none"
        />
      </div>
    </div>
  );
}
