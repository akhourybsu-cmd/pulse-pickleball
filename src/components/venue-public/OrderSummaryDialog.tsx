import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, MapPin, Users, ChevronDown, Check, Plus, Tag, LogIn, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { PublicVenue, VenueCourt } from '@/hooks/usePublicVenue';
import { TimeSlot } from '@/hooks/useVenueAvailability';
import { CourtPickerModal } from './CourtPickerModal';
import { cn } from '@/lib/utils';

interface OrderSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: PublicVenue;
  availableCourts: VenueCourt[];
  date: Date;
  selectedSlots: string[];
  isAuthenticated: boolean;
  onAddMoreTime: () => void;
}

export function OrderSummaryDialog({ 
  open, 
  onOpenChange, 
  venue, 
  availableCourts,
  date, 
  selectedSlots,
  isAuthenticated,
  onAddMoreTime,
}: OrderSummaryDialogProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<VenueCourt | null>(null);
  const [courtPickerOpen, setCourtPickerOpen] = useState(false);
  const [groupSize, setGroupSize] = useState(2);
  const [splitBill, setSplitBill] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoOpen, setPromoOpen] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const primaryColor = venue.primary_color || '#FF6B35';
  
  // Defensive guard: check if we have slots
  const hasSlots = selectedSlots.length > 0;
  
  // Sort slots chronologically
  const sortedSlots = [...selectedSlots].sort();
  const startTime = hasSlots ? sortedSlots[0] : '00:00';
  const endTimeSlot = hasSlots ? sortedSlots[sortedSlots.length - 1] : '00:00';
  
  // Calculate end time (add 30 min to last slot)
  const getEndTime = (time: string | undefined) => {
    if (!time || typeof time !== 'string' || !time.includes(':')) {
      return '00:30';
    }
    const [hours, mins] = time.split(':').map(Number);
    if (isNaN(hours) || isNaN(mins)) return '00:30';
    const totalMins = hours * 60 + mins + 30;
    const endHour = Math.floor(totalMins / 60);
    const endMins = totalMins % 60;
    return `${endHour.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`;
  };
  
  const endTime = getEndTime(endTimeSlot);
  const durationHours = selectedSlots.length * 0.5;
  
  // Format time for display (12:30pm format)
  const formatTimeDisplay = (time: string | undefined) => {
    if (!time || typeof time !== 'string' || !time.includes(':')) {
      return '--:--';
    }
    const parts = time.split(':').map(Number);
    if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
      return '--:--';
    }
    const [hours, minutes] = parts;
    const period = hours >= 12 ? 'pm' : 'am';
    const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHour}:${minutes.toString().padStart(2, '0')}${period}`;
  };
  
  // Calculate pricing
  const baseCourtRate = selectedCourt?.hourly_rate || availableCourts[0]?.hourly_rate || 30;
  const premiumFee = selectedCourt?.premium_fee || 0;
  const basePrice = baseCourtRate * durationHours;
  const totalPrice = basePrice + premiumFee;
  const perPersonPrice = splitBill ? totalPrice / groupSize : totalPrice;
  
  // Get court display name
  const courtDisplayName = selectedCourt 
    ? `${selectedCourt.name}${selectedCourt.court_type !== 'standard' ? ` - ${selectedCourt.court_type.toUpperCase()}` : ''}`
    : 'Auto selection';

  const handleSubmit = async () => {
    if (!isAuthenticated) {
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
      
      // Use selected court or first available
      const courtToBook = selectedCourt || availableCourts[0];
      if (!courtToBook) throw new Error('No court available');
      
      const startTimeStr = `${format(date, 'yyyy-MM-dd')}T${startTime}:00`;
      const endTimeStr = `${format(date, 'yyyy-MM-dd')}T${endTime}:00`;
      
      const { error } = await supabase
        .from('venue_bookings')
        .insert({
          venue_id: venue.id,
          court_id: courtToBook.id,
          user_id: user.id,
          customer_name: profile?.full_name || 'Guest',
          customer_email: profile?.email || '',
          start_time: startTimeStr,
          end_time: endTimeStr,
          total_price: totalPrice,
          status: 'confirmed',
          notes: groupSize > 1 ? `Group size: ${groupSize}` : null,
        });
      
      if (error) throw error;
      
      setSuccess(true);
      toast({
        title: 'Booking Confirmed!',
        description: `${courtToBook.name} reserved for ${format(date, 'MMM d')} at ${formatTimeDisplay(startTime)}`,
      });
      
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
              Your court is reserved for {format(date, 'MMMM d, yyyy')} at {formatTimeDisplay(startTime)}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If no slots selected, show a friendly empty state
  if (!hasSlots) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Order Summary</DialogTitle>
          </DialogHeader>
          <div className="py-8 text-center">
            <p className="text-muted-foreground mb-4">No time slots selected.</p>
            <Button onClick={() => onOpenChange(false)}>
              Go Back & Select Times
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Order Summary</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            {/* Venue & Court Header */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{venue.name}</p>
              </div>
            </div>
            
            {/* Date & Time */}
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="w-5 h-5 text-muted-foreground shrink-0" />
              <div className="flex-1">
                <p className="font-medium">{format(date, 'EEEE, MMM d')}</p>
                <p className="text-sm text-muted-foreground">
                  {formatTimeDisplay(startTime)} - {formatTimeDisplay(endTime)} ({durationHours} hr{durationHours !== 1 ? 's' : ''})
                </p>
              </div>
              <span className="font-semibold" style={{ color: primaryColor }}>
                ${basePrice.toFixed(2)}
              </span>
            </div>
            
            {/* Court Selector */}
            <button
              onClick={() => setCourtPickerOpen(true)}
              className="w-full flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center">
                  <div className="w-3 h-3 rounded-full bg-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Court</p>
                  <p className="text-sm text-muted-foreground">{courtDisplayName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {premiumFee > 0 && (
                  <span className="text-sm font-medium" style={{ color: primaryColor }}>
                    +${premiumFee.toFixed(2)}
                  </span>
                )}
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              </div>
            </button>
            
            {/* Group Size */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium">Group Size</span>
                </div>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((size) => (
                  <button
                    key={size}
                    onClick={() => setGroupSize(size)}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium transition-colors border-2",
                      groupSize === size
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-background hover:border-primary/50"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Split Bill Toggle */}
            {groupSize > 1 && (
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="font-medium">Split the bill</p>
                  <p className="text-sm text-muted-foreground">
                    ${perPersonPrice.toFixed(2)} per person
                  </p>
                </div>
                <Switch 
                  checked={splitBill} 
                  onCheckedChange={setSplitBill}
                />
              </div>
            )}
            
            <Separator />
            
            {/* Subtotal */}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-semibold text-lg">${totalPrice.toFixed(2)}</span>
            </div>
            
            {/* Promo Code */}
            <Collapsible open={promoOpen} onOpenChange={setPromoOpen}>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm text-primary hover:underline">
                <Tag className="w-4 h-4" />
                Enter promo code
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="flex gap-2">
                  <Input 
                    placeholder="Promo code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="flex-1"
                  />
                  <Button variant="outline" size="sm">Apply</Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
            
            {/* Add More Time */}
            <button
              onClick={() => {
                onOpenChange(false);
                onAddMoreTime();
              }}
              className="flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Plus className="w-4 h-4" />
              Add more time
            </button>
            
            <p className="text-xs text-muted-foreground text-center">
              Prices include applicable sales tax
            </p>
            
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
            
            {/* Confirm Button */}
            {isAuthenticated && (
              <Button 
                className="w-full h-12 text-base"
                onClick={handleSubmit}
                disabled={loading}
                style={{ backgroundColor: primaryColor }}
              >
                {loading ? 'Processing...' : `Confirm Booking • $${totalPrice.toFixed(2)}`}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      <CourtPickerModal
        open={courtPickerOpen}
        onOpenChange={setCourtPickerOpen}
        courts={availableCourts}
        selectedCourt={selectedCourt}
        onSelectCourt={(court) => {
          setSelectedCourt(court);
          setCourtPickerOpen(false);
        }}
        primaryColor={primaryColor}
      />
    </>
  );
}
