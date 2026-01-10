import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VenueOnboardingLayout } from '@/components/venue-onboarding/VenueOnboardingLayout';
import { useVenueOnboarding } from '@/hooks/useVenueOnboarding';
import { Calendar, Users, Trophy, GraduationCap, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type EventType = 'round_robin' | 'open_play' | 'clinic';

interface EventOption {
  type: EventType;
  icon: React.ElementType;
  title: string;
  description: string;
  recommended?: boolean;
}

const eventOptions: EventOption[] = [
  {
    type: 'round_robin',
    icon: Trophy,
    title: 'Round Robin',
    description: 'Organized play with rotating partners and skill-based matching',
    recommended: true,
  },
  {
    type: 'open_play',
    icon: Users,
    title: 'Open Play',
    description: 'Drop-in sessions where players rotate courts freely',
  },
  {
    type: 'clinic',
    icon: GraduationCap,
    title: 'Clinic / Lesson',
    description: 'Instructional sessions with coaches or pros',
  },
];

export default function VenueOnboardingFirstEvent() {
  const navigate = useNavigate();
  const { skipToStep } = useVenueOnboarding();
  const [selectedType, setSelectedType] = useState<EventType | null>(null);

  const handleContinue = () => {
    if (!selectedType) return;
    
    // Navigate to the appropriate event creation page
    switch (selectedType) {
      case 'round_robin':
        navigate('/venue/round-robins?create=true');
        break;
      case 'open_play':
      case 'clinic':
        navigate('/venue/events?create=true&type=' + selectedType);
        break;
    }
  };

  const handleSkip = () => {
    skipToStep('share');
  };

  return (
    <VenueOnboardingLayout currentStep={2} totalSteps={4}>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="mx-auto mb-4"
            >
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Calendar className="h-7 w-7 text-primary" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl">Create Your First Event</CardTitle>
            <CardDescription>
              What type of event would you like to host?
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="grid gap-3">
              {eventOptions.map((option, index) => (
                <motion.div
                  key={option.type}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedType(option.type)}
                    className={cn(
                      "w-full p-4 rounded-lg border-2 text-left transition-all",
                      "hover:border-primary/50 hover:bg-muted/50",
                      selectedType === option.type
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0",
                        selectedType === option.type
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}>
                        <option.icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{option.title}</h3>
                          {option.recommended && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {option.description}
                        </p>
                      </div>
                      {selectedType === option.type && (
                        <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <Check className="h-4 w-4 text-primary-foreground" />
                        </div>
                      )}
                    </div>
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="flex flex-col gap-2 pt-4">
              <Button 
                size="lg"
                disabled={!selectedType}
                onClick={handleContinue}
                className="w-full"
              >
                Continue to Create Event
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
