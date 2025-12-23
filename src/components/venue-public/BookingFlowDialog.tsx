import { useState } from 'react';
import { format, addHours, parseISO } from 'date-fns';
import { Calendar, Clock, MapPin, User, LogIn, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PublicVenue, VenueCourt } from '@/hooks/usePublicVenue';
import { TimeSlot } from '@/hooks/useVenueAvailability';

interface BookingFlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: PublicVenue;
  court: VenueCourt | null;
  date: Date | null;
  slot: TimeSlot | null;
  isAuthenticated: boolean;
}

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
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const primaryColor = venue.primary_color || '#FF6B35';

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
      const endTime = `${format(date, 'yyyy-MM-dd')}T${slot.endTime}:00`;
      
      const { error } = await supabase
        .from('venue_bookings')
        .insert({
          venue_id: venue.id,
          court_id: court.id,
          user_id: user.id,
          customer_name: profile?.full_name || customerName || 'Guest',
          customer_email: profile?.email || customerEmail,
          customer_phone: customerPhone || null,
          start_time: startTime,
          end_time: endTime,
          total_price: court.hourly_rate || 0,
          status: 'confirmed',
        });
      
      if (error) throw error;
      
      setSuccess(true);
      toast({
        title: 'Booking Confirmed!',
        description: `${court.name} reserved for ${format(date, 'MMM d')} at ${slot.startTime}`,
      });
      
      // Close after a moment
      setTimeout(() => {
        setSuccess(false);
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
              <p className="font-medium">{slot?.startTime} - {slot?.endTime}</p>
              <p className="text-sm text-muted-foreground">1 hour</p>
            </div>
          </div>
          
          {court?.hourly_rate && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>
                  ${court.hourly_rate}
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
