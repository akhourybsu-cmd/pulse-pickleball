import { FileText, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">Name your event</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Short and clear works best — players scan, they don't read.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Event name</Label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g., Tuesday Open Play"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="flex-1"
              maxLength={80}
              autoFocus
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAutoGenerate}
              title="Auto-generate name"
              aria-label="Auto-generate name"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-medium">
            Description <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            placeholder="Skill level, what to bring, anything else members should know…"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            rows={3}
            maxLength={500}
            className="resize-none"
          />
        </div>
      </div>
    </div>
  );
}
