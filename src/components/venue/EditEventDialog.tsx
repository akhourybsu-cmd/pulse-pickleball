import { useState, useEffect, useMemo } from 'react';
import { format, addMinutes, setHours, setMinutes, startOfDay, differenceInMinutes, parseISO } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Users, DollarSign, Trophy } from 'lucide-react';
import { VenueEvent } from '@/hooks/useVenueEvents';
import { cn } from '@/lib/utils';

interface EditEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: VenueEvent | null;
  onSave: (id: string, updates: Partial<VenueEvent>) => Promise<void>;
}

const EVENT_TYPES: { value: VenueEvent['event_type']; label: string }[] = [
  { value: 'social', label: 'Social Play' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'tournament', label: 'Tournament' },
  { value: 'league', label: 'League' },
  { value: 'other', label: 'Other' }
];

const SKILL_LEVELS = ['All Levels', 'Beginner', 'Intermediate', 'Advanced'];

// Generate time slots in 30-minute increments
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = (i % 2) * 30;
  const date = setMinutes(setHours(new Date(), hours), minutes);
  return {
    value: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
    label: format(date, 'h:mm a')
  };
});

// Duration options in 30-minute increments
const DURATION_OPTIONS = [
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
  { value: 150, label: '2.5 hours' },
  { value: 180, label: '3 hours' },
  { value: 210, label: '3.5 hours' },
  { value: 240, label: '4 hours' },
  { value: 300, label: '5 hours' },
  { value: 360, label: '6 hours' },
  { value: 480, label: '8 hours' },
];

export function EditEventDialog({
  open,
  onOpenChange,
  event,
  onSave
}: EditEventDialogProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    event_type: 'social' as VenueEvent['event_type'],
    date: undefined as Date | undefined,
    startTime: '09:00',
    duration: 120,
    max_participants: '',
    price: '',
    skill_level: 'All Levels',
    is_published: false
  });

  // Initialize form when event changes
  useEffect(() => {
    if (event) {
      const start = parseISO(event.start_time);
      const end = parseISO(event.end_time);
      const durationMinutes = differenceInMinutes(end, start);
      
      // Find closest duration option
      const closestDuration = DURATION_OPTIONS.reduce((prev, curr) => 
        Math.abs(curr.value - durationMinutes) < Math.abs(prev.value - durationMinutes) ? curr : prev
      ).value;

      setFormData({
        title: event.title,
        description: event.description || '',
        event_type: event.event_type,
        date: start,
        startTime: format(start, 'HH:mm'),
        duration: closestDuration,
        max_participants: event.max_participants?.toString() || '',
        price: event.price?.toString() || '',
        skill_level: event.skill_level || 'All Levels',
        is_published: event.is_published
      });
    }
  }, [event]);

  // Calculate end time display
  const endTimeDisplay = useMemo(() => {
    if (!formData.startTime) return '';
    const [hours, minutes] = formData.startTime.split(':').map(Number);
    const startDate = setMinutes(setHours(new Date(), hours), minutes);
    const endDate = addMinutes(startDate, formData.duration);
    return format(endDate, 'h:mm a');
  }, [formData.startTime, formData.duration]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !formData.date || !formData.startTime) return;

    setSaving(true);
    try {
      const [startHours, startMinutes] = formData.startTime.split(':').map(Number);
      const startDateTime = setMinutes(setHours(startOfDay(formData.date), startHours), startMinutes);
      const endDateTime = addMinutes(startDateTime, formData.duration);

      await onSave(event.id, {
        title: formData.title,
        description: formData.description || null,
        event_type: formData.event_type,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        price: formData.price ? parseFloat(formData.price) : null,
        skill_level: formData.skill_level || null,
        is_published: formData.is_published
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error saving event:', error);
    } finally {
      setSaving(false);
    }
  };

  const isFormValid = formData.title.trim() && formData.date && formData.startTime;

  if (!event) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Event</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Event Type - Quick Selection Pills */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Event Type</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, event_type: type.value }))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    formData.event_type === type.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="edit-title">Event Title *</Label>
            <Input
              id="edit-title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Saturday Morning Social"
              className="h-11"
            />
          </div>

          {/* Date and Time Row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Date Picker */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                Date *
              </Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-11 justify-start text-left font-normal",
                      !formData.date && "text-muted-foreground"
                    )}
                  >
                    {formData.date ? format(formData.date, 'EEE, MMM d') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => {
                      setFormData(prev => ({ ...prev, date }));
                      setCalendarOpen(false);
                    }}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Start Time */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Start Time *
              </Label>
              <Select
                value={formData.startTime}
                onValueChange={(value) => setFormData(prev => ({ ...prev, startTime: value }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {TIME_SLOTS.map(slot => (
                    <SelectItem key={slot.value} value={slot.value}>
                      {slot.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Duration with End Time Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Duration</Label>
              {formData.startTime && (
                <span className="text-sm text-muted-foreground">
                  Ends at {endTimeDisplay}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_OPTIONS.slice(0, 8).map(option => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, duration: option.value }))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    formData.duration === option.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <Select
              value={formData.duration.toString()}
              onValueChange={(value) => setFormData(prev => ({ ...prev, duration: parseInt(value) }))}
            >
              <SelectTrigger className="h-9 w-full mt-2">
                <SelectValue placeholder="Or select custom duration" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Capacity and Price Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-max_participants" className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                Max Players
              </Label>
              <Input
                id="edit-max_participants"
                type="number"
                inputMode="numeric"
                min="1"
                max="999"
                value={formData.max_participants}
                onChange={(e) => setFormData(prev => ({ ...prev, max_participants: e.target.value }))}
                placeholder="Unlimited"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-price" className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5" />
                Price
              </Label>
              <Input
                id="edit-price"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="Free"
                className="h-11"
              />
            </div>
          </div>

          {/* Skill Level - Quick Pills */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              Skill Level
            </Label>
            <div className="flex flex-wrap gap-2">
              {SKILL_LEVELS.map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, skill_level: level }))}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                    formData.skill_level === level
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="edit-description">Description (optional)</Label>
            <Textarea
              id="edit-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add event details, what to bring, etc."
              rows={2}
              className="resize-none"
            />
          </div>

          {/* Publish Toggle */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div>
              <Label htmlFor="edit-is_published" className="font-medium">Published</Label>
              <p className="text-xs text-muted-foreground">Make visible to players</p>
            </div>
            <Switch
              id="edit-is_published"
              checked={formData.is_published}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_published: checked }))}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={saving || !isFormValid}
              className="flex-1 h-11"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
