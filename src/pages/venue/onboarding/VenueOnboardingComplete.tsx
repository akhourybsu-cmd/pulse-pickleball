import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VenueOnboardingLayout } from '@/components/venue-onboarding/VenueOnboardingLayout';
import { useVenueOnboarding } from '@/hooks/useVenueOnboarding';
import { 
  PartyPopper, 
  Calendar, 
  BarChart3, 
  Users, 
  Settings,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function VenueOnboardingComplete() {
  const navigate = useNavigate();
  const { venueName, completeOnboarding, hasCompletedProfile, hasFirstEvent } = useVenueOnboarding();

  const handleGoToDashboard = async () => {
    await completeOnboarding();
  };

  const nextSteps = [
    {
      icon: Calendar,
      title: 'Create more events',
      description: 'Keep your schedule full with recurring events',
      action: '/venue/events',
    },
    {
      icon: Users,
      title: 'Invite your team',
      description: 'Add staff members to help manage your venue',
      action: '/venue/staff',
    },
    {
      icon: BarChart3,
      title: 'Track analytics',
      description: 'Monitor attendance and revenue trends',
      action: '/venue/analytics',
    },
    {
      icon: Settings,
      title: 'Customize settings',
      description: 'Configure branding, payments, and more',
      action: '/venue/settings',
    },
  ];

  const completedItems = [
    { label: 'Venue profile', done: hasCompletedProfile },
    { label: 'First event created', done: hasFirstEvent },
    { label: 'Sharing link ready', done: true },
  ];

  return (
    <VenueOnboardingLayout currentStep={4} totalSteps={4}>
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', duration: 0.8 }}
              className="mx-auto mb-4"
            >
              <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto">
                <PartyPopper className="h-10 w-10 text-primary-foreground" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl">You're All Set! 🎉</CardTitle>
            <CardDescription>
              {venueName || 'Your venue'} is ready to welcome players
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {/* Completed checklist */}
            <div className="rounded-lg border bg-muted/30 p-4">
              <h4 className="font-medium mb-3">Setup Complete</h4>
              <div className="space-y-2">
                {completedItems.map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 className={`h-5 w-5 ${item.done ? 'text-green-500' : 'text-muted-foreground'}`} />
                    <span className={item.done ? '' : 'text-muted-foreground'}>{item.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Next steps */}
            <div>
              <h4 className="font-medium mb-3">What's Next</h4>
              <div className="grid gap-2">
                {nextSteps.map((step, index) => (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    onClick={() => navigate(step.action)}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors text-left w-full"
                  >
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </motion.button>
                ))}
              </div>
            </div>

            <Button 
              size="lg"
              onClick={handleGoToDashboard}
              className="w-full"
            >
              Go to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </VenueOnboardingLayout>
  );
}
