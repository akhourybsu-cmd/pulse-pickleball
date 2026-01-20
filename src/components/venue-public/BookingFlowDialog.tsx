import { useState } from 'react';
import { format, addHours } from 'date-fns';
import { Calendar, Clock, MapPin, User, LogIn, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
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
import { PublicVenue, VenueCourt } from '@/hooks/usePublicVenue';
import { TimeSlot } from '@/hooks/useVenueAvailability';
import { DEFAULT_VENUE_COLORS } from '@/lib/venueBranding';

interface BookingFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: PublicVenue;
  court: VenueCourt | null;
  date: Date | null;
  slot: TimeSlot | null;
  isAuthenticated: boolean;
}

const DURATION_OPTIONS = [
  { value: '1', label: '1 hour', hours: 1 },
  { value: '1.5', label: '1.5 hours', hours: 1.5 },
  { value: '2', label: '2 hours', hours: 2 },
  { value: '2.5', label: '2.5 hours', hours: 2.5 },
  { value: '3', label: '3 hours', hours: 3 },
];

export function BookingFlowDialog({ 
  open, 
  onOpenChange, 
  venue, 
  court, 
  date, 
  slot,
  isAuthenticated 
}: BookingFlowDialogProps) {
  const [loading, setLoading] = useState(false);
  const [customerPhone, setCustomerPhone] = useState('');
  const [success, setSuccess] = useState(false);
  const [duration, setDuration] = useState('1');
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const primaryColor = venue.primary_color || DEFAULT_VENUE_COLORS.primary;
  
  // Calculate end time and total price based on duration
  const durationHours = DURATION_OPTIONS.find(d => d.value === duration)?.hours || 1;
  const totalPrice = court?.hourly_rate ? court.hourly_rate * durationHours : 0;
  
  const getEndTime = () => {
    if (!slot) return '';
    const [hours, mins] = slot.startTime.split(':').map(Number);
    const endHour = hours + durationHours;
    const endMins = (durationHours % 1) * 60 + mins;
    const finalHour = Math.floor(endHour + endMins / 60);
    const finalMins = endMins % 60;
    return `${finalHour.toString().padStart(2, '0')}:${finalMins.toString().padStart(2, '0')}`;
  };

  const handleSubmit = async () => {
    if (!court || !date || !slot) return;
    
    if (!isAuthenticated) {
      // Redirect to login with return URL
      navigate(`/auth?redirect=/v/${venue.slug}`);
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Get user profile for name/email
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user.id)
        .single();
      
      const startTime = `${format(date, 'yyyy-MM-dd')}T${slot.startTime}:00`;
      const endTimeStr = `${format(date, 'yyyy-MM-dd')}T${getEndTime()}:00`;
      
      const { error } = await supabase
        .from('venue_bookings')
        .insert({
          venue_id: venue.id,
          court_id: court.id,
          user_id: user.id,
          customer_name: profile?.full_name || 'Guest',
          customer_email: profile?.email || '',
          customer_phone: customerPhone || null,
          start_time: startTime,
          end_time: endTimeStr,
          total_price: totalPrice,
          status: 'confirmed',
        });
      
      if (error) throw error;
      
      setSuccess(true);
      toast({
        title: 'Booking Confirmed!',
        description: `${court.name} reserved for ${format(date, 'MMM d')} at ${slot.startTime} (${durationHours} hr${durationHours > 1 ? 's' : ''})`,
      });
      
      // Close after a moment and reset
      setTimeout(() => {
        setSuccess(false);
        setDuration('1');
        onOpenChange(false);
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
            <h3 className="text-xl font-semibold mb-2">Booking Confirmed!</h3>
            <p className="text-muted-foreground text-center">
              {court?.name} on {date && format(date, 'MMMM d, yyyy')} at {slot?.startTime}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Booking</DialogTitle>
          <DialogDescription>
            Review your court reservation details
          </DialogDescription>
        </DialogHeader>
        
        {/* Booking Summary */}
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{court?.name}</p>
              {court?.surface_type && (
                <p className="text-sm text-muted-foreground">{court.surface_type}</p>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{date && format(date, 'EEEE, MMMM d, yyyy')}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{slot?.startTime} - {getEndTime()}</p>
              <p className="text-sm text-muted-foreground">{durationHours} hour{durationHours > 1 ? 's' : ''}</p>
            </div>
          </div>
          
          {/* Duration Selector */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label} {court?.hourly_rate ? `- $${(court.hourly_rate * opt.hours).toFixed(2)}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {court?.hourly_rate && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-muted-foreground">Total</span>
                  <p className="text-xs text-muted-foreground">${court.hourly_rate}/hr × {durationHours}</p>
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
              Sign in to complete your booking
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
              disabled={loading}
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Booking...' : 'Confirm Booking'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
