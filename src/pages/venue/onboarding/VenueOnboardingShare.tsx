import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { VenueOnboardingLayout } from '@/components/venue-onboarding/VenueOnboardingLayout';
import { useVenueOnboarding } from '@/hooks/useVenueOnboarding';
import { Share2, Copy, Check, ArrowRight, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function VenueOnboardingShare() {
  const navigate = useNavigate();
  const { venueSlug, venueName, skipToStep } = useVenueOnboarding();
  const [copied, setCopied] = useState(false);

  const venueUrl = `${window.location.origin}/v/${venueSlug || 'your-venue'}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(venueUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy link');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: venueName || 'Check out this venue',
          text: `Play pickleball at ${venueName}`,
          url: venueUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      handleCopy();
    }
  };

  const handleContinue = () => {
    navigate('/venue/onboarding/complete');
  };

  const handleSkip = () => {
    skipToStep('complete');
  };

  return (
    <VenueOnboardingLayout currentStep={3} totalSteps={4}>
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto mb-4"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Share2 className="h-7 w-7 text-primary" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl">Share Your Venue</CardTitle>
            <CardDescription>
              Let players discover {venueName || 'your venue'} and sign up for events
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Venue URL */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Your venue link</label>
              <div className="flex gap-2">
                <Input 
                  value={venueUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopy}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Preview Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="rounded-lg border bg-muted/30 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Preview</span>
                <a 
                  href={venueUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  Open page
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="bg-background rounded-md p-4 border">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-xl">🏓</span>
                  </div>
                  <div>
                    <h4 className="font-semibold">{venueName || 'Your Venue'}</h4>
                    <p className="text-sm text-muted-foreground">View events & book courts</p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Share options */}
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={handleCopy}
                className="w-full"
              >
                <Copy className="mr-2 h-4 w-4" />
                Copy Link
              </Button>
              <Button
                variant="outline"
                onClick={handleShare}
                className="w-full"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <Button 
                size="lg"
                onClick={handleContinue}
                className="w-full"
              >
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                variant="ghost"
                onClick={handleSkip}
                className="text-muted-foreground"
              >
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </VenueOnboardingLayout>
  );
}
