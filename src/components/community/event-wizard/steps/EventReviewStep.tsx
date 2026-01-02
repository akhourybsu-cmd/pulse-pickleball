import { Calendar, Clock, MapPin, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { EventWizardFormData, EVENT_TYPE_OPTIONS } from '../types';

interface EventReviewStepProps {
  formData: EventWizardFormData;
}

export function EventReviewStep({ formData }: EventReviewStepProps) {
  const eventType = EVENT_TYPE_OPTIONS.find((t) => t.value === formData.eventType);
  
  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
    } catch {
      return dateStr;
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${minutes} ${ampm}`;
  };

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Review your event</h3>
      
      <div className="space-y-2 bg-muted/30 rounded-lg p-3">
        <div className="flex items-start gap-2">
          <span className="text-lg">{eventType?.icon}</span>
          <div>
            <p className="font-medium">{formData.title || 'Untitled Event'}</p>
            {formData.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{formData.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{formData.date ? formatDate(formData.date) : 'No date set'}</span>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          <span>
            {formData.startTime ? formatTime(formData.startTime) : 'No time set'}
            {formData.endTime && ` - ${formatTime(formData.endTime)}`}
          </span>
        </div>
        
        {formData.location && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            <span>{formData.location}</span>
          </div>
        )}
        
        {formData.capacity && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>Max {formData.capacity} participants</span>
          </div>
        )}
      </div>
    </div>
  );
}
