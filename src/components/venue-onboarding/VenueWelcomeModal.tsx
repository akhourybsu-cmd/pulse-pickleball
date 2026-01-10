import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Building2, Calendar, Share2, Sparkles } from 'lucide-react';

interface VenueWelcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venueName?: string | null;
  onGetStarted: () => void;
  onSkip: () => void;
}

export const VenueWelcomeModal = ({
  open,
  onOpenChange,
  venueName,
  onGetStarted,
  onSkip,
}: VenueWelcomeModalProps) => {
  const steps = [
    {
      icon: Building2,
      title: 'Set up your profile',
      description: 'Add your logo and description',
    },
    {
      icon: Calendar,
      title: 'Create your first event',
      description: 'Round robin, open play, or clinic',
    },
    {
      icon: Share2,
      title: 'Share your venue',
      description: 'Get players to discover you',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center pb-2">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mx-auto mb-4"
          >
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto">
              <Sparkles className="h-8 w-8 text-primary-foreground" />
            </div>
          </motion.div>
          
          <DialogTitle className="text-2xl">
            Welcome{venueName ? `, ${venueName}` : ''}! 🎉
          </DialogTitle>
          <DialogDescription className="text-base">
            Let's get your venue ready to host amazing pickleball events
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="flex items-center gap-4 p-3 rounded-lg bg-muted/50"
            >
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <step.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={onGetStarted} className="w-full" size="lg">
            Get Started
          </Button>
          <Button 
            variant="ghost" 
            onClick={onSkip}
            className="text-muted-foreground"
          >
            I'll do this later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
