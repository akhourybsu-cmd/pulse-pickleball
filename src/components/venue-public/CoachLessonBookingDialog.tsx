import { useState, useEffect } from 'react';
import { format, addDays, startOfToday, isSameDay, setHours, setMinutes, addHours } from 'date-fns';
import { Calendar, Clock, User, DollarSign, Check, LogIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PublicVenue, VenueCoach } from '@/hooks/usePublicVenue';
import { cn } from '@/lib/utils';

interface CoachLessonBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: PublicVenue;
  coach: VenueCoach | null;
  isAuthenticated: boolean;
}

const LESSON_DURATIONS = [
  { value: '30', label: '30 minutes', hours: 0.5 },
  { value: '60', label: '1 hour', hours: 1 },
  { value: '90', label: '1.5 hours', hours: 1.5 },
  { value: '120', label: '2 hours', hours: 2 },
];

const TIME_SLOTS = Array.from({ length: 12 }, (_, i) => {
  const hour = 8 + i; // 8am to 7pm
  return {
    value: `${hour.toString().padStart(2, '0')}:00`,
    label: `${hour > 12 ? hour - 12 : hour}:00 ${hour >= 12 ? 'PM' : 'AM'}`,
  };
});

export function CoachLessonBookingDialog({
  open,
  onOpenChange,
  venue,
  coach,
  isAuthenticated,
}: CoachLessonBookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [dateOffset, setDateOffset] = useState(0);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [duration, setDuration] = useState('60');
  const [notes, setNotes] = useState('');

  const navigate = useNavigate();
  const { toast } = useToast();

  const primaryColor = venue.primary_color || '#FF6B35';

  // Generate dates for date picker
  const dates = Array.from({ length: 7 }, (_, i) => addDays(startOfToday(), dateOffset + i));

  // Calculate total price
  const durationHours = LESSON_DURATIONS.find(d => d.value === duration)?.hours || 1;
  const totalPrice = coach?.hourly_rate ? coach.hourly_rate * durationHours : 0;

  const handleSubmit = async () => {
    if (!coach || !selectedTime) return;

    if (!isAuthenticated) {
      navigate(`/auth?redirect=/v/${venue.slug}`);
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const startTime = `${format(selectedDate, 'yyyy-MM-dd')}T${selectedTime}:00`;
      const endDate = addHours(new Date(startTime), durationHours);
      const endTime = endDate.toISOString();

      const { error } = await supabase
        .from('venue_lessons')
        .insert({
          venue_id: venue.id,
          coach_id: coach.id,
          start_time: startTime,
          end_time: endTime,
          price: totalPrice,
          status: 'pending',
          lesson_type: 'private',
          title: `Lesson with ${user.email?.split('@')[0] || 'Student'}`,
          description: notes || null,
          max_students: 1,
          current_students: 1,
        });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: 'Lesson Request Sent!',
        description: `Your lesson with ${coach.name} has been requested for ${format(selectedDate, 'MMM d')} at ${selectedTime}`,
      });

      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
        // Reset form
        setSelectedTime('');
        setDuration('60');
        setNotes('');
      }, 2000);

    } catch (err: any) {
      console.error('Booking error:', err);
      toast({
        title: 'Booking Failed',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <Check className="w-8 h-8" style={{ color: primaryColor }} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Lesson Requested!</h3>
            <p className="text-muted-foreground text-center">
              {coach?.name} will confirm your lesson for {format(selectedDate, 'MMMM d, yyyy')} at {selectedTime}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book a Lesson</DialogTitle>
          <DialogDescription>
            Schedule a lesson with {coach?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Coach Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${primaryColor}20` }}
            >
              <User className="w-6 h-6" style={{ color: primaryColor }} />
            </div>
            <div>
              <p className="font-medium">{coach?.name}</p>
              {coach?.hourly_rate && (
                <p className="text-sm text-muted-foreground">${coach.hourly_rate}/hour</p>
              )}
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-2">
            <Label>Select Date</Label>
            <div className="flex items-center justify-between mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDateOffset(prev => Math.max(0, prev - 7))}
                disabled={dateOffset === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                {format(dates[0], 'MMM yyyy')}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDateOffset(prev => prev + 7)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {dates.map((date) => {
                const isSelected = isSameDay(date, selectedDate);
                const isToday = isSameDay(date, startOfToday());
                return (
                  <button
                    key={date.toISOString()}
                    onClick={() => setSelectedDate(date)}
                    className={cn(
                      "flex-shrink-0 flex flex-col items-center justify-center w-11 h-14 rounded-lg transition-all",
                      isSelected
                        ? "text-white shadow-md"
                        : "bg-muted/50 text-foreground hover:bg-muted"
                    )}
                    style={isSelected ? { backgroundColor: primaryColor } : undefined}
                  >
                    <span className="text-xs font-medium uppercase">{format(date, 'EEE')}</span>
                    <span className="text-lg font-bold">{format(date, 'd')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label>Select Time</Label>
            <Select value={selectedTime} onValueChange={setSelectedTime}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a time" />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={slot.value} value={slot.value}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration Selection */}
          <div className="space-y-2">
            <Label>Lesson Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any specific areas you'd like to work on?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Price Summary */}
          {coach?.hourly_rate && selectedTime && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Total</span>
                  <p className="text-xs text-muted-foreground">
                    ${coach.hourly_rate}/hr × {durationHours} hr{durationHours > 1 ? 's' : ''}
                  </p>
                </div>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Auth Required Message */}
        {!isAuthenticated && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <User className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Sign in to book a lesson
            </p>
            <Button
              onClick={() => navigate(`/auth?redirect=/v/${venue.slug}`)}
              style={{ backgroundColor: primaryColor }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In to Book
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {isAuthenticated && (
            <Button
              onClick={handleSubmit}
              disabled={loading || !selectedTime}
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Requesting...' : 'Request Lesson'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
