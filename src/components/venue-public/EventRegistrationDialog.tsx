import { useState } from 'react';
import { format } from 'date-fns';
import { Calendar, Clock, Users, DollarSign, LogIn, User, Check, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { PublicVenue, VenueEvent } from '@/hooks/usePublicVenue';

interface EventRegistrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venue: PublicVenue;
  event: VenueEvent | null;
  isAuthenticated: boolean;
  isRegistered: boolean;
  onSuccess: () => void;
}

export function EventRegistrationDialog({ 
  open, 
  onOpenChange, 
  venue, 
  event,
  isAuthenticated,
  isRegistered,
  onSuccess
}: EventRegistrationDialogProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const primaryColor = venue.primary_color || '#FF6B35';
  
  const isFull = event?.max_participants 
    ? event.current_participants >= event.max_participants 
    : false;

  const handleRegister = async () => {
    if (!event) return;
    
    if (!isAuthenticated) {
      navigate(`/auth?redirect=/v/${venue.slug}`);
      return;
    }
    
    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Check if already registered
      const { data: existing } = await supabase
        .from('venue_event_registrations')
        .select('id')
        .eq('event_id', event.id)
        .eq('user_id', user.id)
        .eq('status', 'registered')
        .single();
      
      if (existing) {
        toast({
          title: 'Already Registered',
          description: 'You are already registered for this event',
        });
        onOpenChange(false);
        return;
      }
      
      // Create registration
      const { error: regError } = await supabase
        .from('venue_event_registrations')
        .insert({
          event_id: event.id,
          user_id: user.id,
          status: 'registered',
        });
      
      if (regError) throw regError;
      
      // Update participant count
      const { error: updateError } = await supabase
        .from('venue_events')
        .update({ current_participants: event.current_participants + 1 })
        .eq('id', event.id);
      
      if (updateError) {
        console.error('Failed to update count:', updateError);
      }
      
      setSuccess(true);
      onSuccess();
      
      toast({
        title: 'Registration Successful!',
        description: `You are registered for ${event.title}`,
      });
      
      setTimeout(() => {
        setSuccess(false);
        onOpenChange(false);
      }, 2000);
      
    } catch (err: any) {
      console.error('Registration error:', err);
      toast({
        title: 'Registration Failed',
        description: err.message || 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!event) return null;

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
            <h3 className="text-xl font-semibold mb-2">You're Registered!</h3>
            <p className="text-muted-foreground text-center">
              See you at {event.title} on {format(new Date(event.start_time), 'MMMM d')}
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
          <DialogTitle>Event Registration</DialogTitle>
          <DialogDescription>
            {isRegistered ? 'You are registered for this event' : 'Register for this event'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Event Details */}
        <div className="space-y-4 py-4">
          <div>
            <Badge 
              variant="outline" 
              className="mb-2"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              {event.event_type}
            </Badge>
            <h3 className="text-lg font-semibold">{event.title}</h3>
            {event.description && (
              <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{format(new Date(event.start_time), 'MMM d, yyyy')}</span>
            </div>
            
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{format(new Date(event.start_time), 'h:mm a')}</span>
            </div>
          </div>
          
          {event.max_participants && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">
                {event.current_participants} / {event.max_participants} spots filled
              </span>
              {isFull && (
                <Badge variant="destructive" className="ml-auto">Full</Badge>
              )}
            </div>
          )}
          
          {event.skill_level && (
            <div>
              <Badge variant="secondary">{event.skill_level}</Badge>
            </div>
          )}
          
          {event.price !== null && event.price > 0 && (
            <>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Registration Fee</span>
                <span className="text-xl font-bold" style={{ color: primaryColor }}>
                  ${event.price}
                </span>
              </div>
            </>
          )}
        </div>
        
        {/* Already Registered */}
        {isRegistered && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
            <Check className="w-8 h-8 mx-auto text-green-500 mb-2" />
            <p className="text-sm text-green-700 dark:text-green-400">
              You are registered for this event
            </p>
          </div>
        )}
        
        {/* Full Event Warning */}
        {isFull && !isRegistered && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 text-center">
            <AlertCircle className="w-8 h-8 mx-auto text-orange-500 mb-2" />
            <p className="text-sm text-orange-700 dark:text-orange-400">
              This event is currently full
            </p>
          </div>
        )}
        
        {/* Auth Required Message */}
        {!isAuthenticated && !isFull && (
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
            <User className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              Sign in to register for this event
            </p>
            <Button
              onClick={() => navigate(`/auth?redirect=/v/${venue.slug}`)}
              style={{ backgroundColor: primaryColor }}
            >
              <LogIn className="w-4 h-4 mr-2" />
              Sign In to Register
            </Button>
          </div>
        )}
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {isAuthenticated && !isRegistered && !isFull && (
            <Button 
              onClick={handleRegister}
              disabled={loading}
              style={{ backgroundColor: primaryColor }}
            >
              {loading ? 'Registering...' : 'Register Now'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
