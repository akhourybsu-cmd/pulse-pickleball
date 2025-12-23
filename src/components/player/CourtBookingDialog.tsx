import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { format, addHours, setHours, setMinutes, startOfDay } from 'date-fns';
import { CalendarIcon, Clock, DollarSign } from 'lucide-react';
import { PublicVenueCourt, PublicVenue } from '@/hooks/usePublicVenues';
import { CreatePlayerBookingData } from '@/hooks/usePlayerBookings';

interface CourtBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: PublicVenue;
  courts: PublicVenueCourt[];
  onBook: (data: CreatePlayerBookingData) => Promise<any>;
}

const TIME_SLOTS = Array.from({ length: 28 }, (_, i) => {
  const hour = Math.floor(i / 2) + 6; // Start at 6 AM
  const minutes = (i % 2) * 30;
  return `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
});

export function CourtBookingDialog({ open, onOpenChange, venue, courts, onBook }: CourtBookingDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState('1');

  const selectedCourtData = courts.find(c => c.id === selectedCourt);
  const hourlyRate = selectedCourtData?.hourly_rate || 0;
  const totalPrice = hourlyRate * parseFloat(duration);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourt || !selectedDate) return;

    setLoading(true);
    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = setMinutes(setHours(selectedDate, hours), minutes);
      const endDateTime = addHours(startDateTime, parseFloat(duration));

      await onBook({
        venue_id: venue.id,
        court_id: selectedCourt,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
      });
      
      onOpenChange(false);
      // Reset form
      setSelectedCourt('');
      setSelectedDate(new Date());
      setStartTime('09:00');
      setDuration('1');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Book a Court</DialogTitle>
          <DialogDescription>
            Reserve a court at {venue.name}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Select Court</Label>
            <Select value={selectedCourt} onValueChange={setSelectedCourt}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a court" />
              </SelectTrigger>
              <SelectContent>
                {courts.map(court => (
                  <SelectItem key={court.id} value={court.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{court.name} (Court {court.court_number})</span>
                      {court.hourly_rate && (
                        <span className="text-muted-foreground ml-2">${court.hourly_rate}/hr</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < startOfDay(new Date())}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_SLOTS.map(time => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.5">30 minutes</SelectItem>
                  <SelectItem value="1">1 hour</SelectItem>
                  <SelectItem value="1.5">1.5 hours</SelectItem>
                  <SelectItem value="2">2 hours</SelectItem>
                  <SelectItem value="2.5">2.5 hours</SelectItem>
                  <SelectItem value="3">3 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedCourtData && hourlyRate > 0 && (
            <div className="rounded-lg bg-muted p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Estimated Total</span>
                </div>
                <span className="font-semibold">${totalPrice.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                ${hourlyRate}/hr × {duration} hour(s)
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !selectedCourt || !selectedDate}>
              {loading ? 'Booking...' : 'Book Court'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
