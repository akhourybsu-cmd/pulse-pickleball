import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VenueOnboardingLayout } from '@/components/venue-onboarding/VenueOnboardingLayout';
import { useVenueOnboarding } from '@/hooks/useVenueOnboarding';
import { useMode } from '@/contexts/ModeContext';
import { supabase } from '@/integrations/supabase/client';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function VenueOnboardingProfile() {
  const navigate = useNavigate();
  const { currentVenue, currentVenueId } = useMode();
  const { updateVenueProfile, skipToStep } = useVenueOnboarding();
  
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch venue details including tagline and description
  useEffect(() => {
    const fetchVenueDetails = async () => {
      if (!currentVenueId) return;
      
      const { data } = await supabase
        .from('venues')
        .select('tagline, description')
        .eq('id', currentVenueId)
        .single();
      
      if (data) {
        setTagline(data.tagline || '');
        setDescription(data.description || '');
      }
      setIsLoading(false);
    };
    
    fetchVenueDetails();
  }, [currentVenueId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const success = await updateVenueProfile({
      tagline: tagline.trim(),
      description: description.trim(),
    });

    setIsSubmitting(false);

    if (success) {
      toast.success('Profile updated!');
      navigate('/venue/onboarding/first-event');
    } else {
      toast.error('Failed to update profile');
    }
  };

  const handleSkip = () => {
    skipToStep('first-event');
  };

  return (
    <VenueOnboardingLayout currentStep={1} totalSteps={4}>
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto mb-4"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl">Set Up Your Profile</CardTitle>
            <CardDescription>
              Help players understand what makes {currentVenue?.venue_name || 'your venue'} special
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  placeholder="e.g., Premier indoor pickleball destination"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  maxLength={80}
                />
                <p className="text-xs text-muted-foreground">
                  {tagline.length}/80 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Tell players about your courts, amenities, and what makes your venue great..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  {description.length}/500 characters
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-4">
                <Button 
                  type="submit" 
                  size="lg"
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
                <Button 
                  type="button"
                  variant="ghost"
                  onClick={handleSkip}
                  className="text-muted-foreground"
                >
                  Skip for now
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </VenueOnboardingLayout>
  );
}
