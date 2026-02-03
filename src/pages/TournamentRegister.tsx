import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CheckCircle, ArrowLeft } from "lucide-react";
import { RegistrationStepDivision } from "@/components/tournament/RegistrationStepDivision";
import { RegistrationStepTeamInfo } from "@/components/tournament/RegistrationStepTeamInfo";
import { RegistrationStepAdditionalInfo } from "@/components/tournament/RegistrationStepAdditionalInfo";
import { RegistrationStepReview } from "@/components/tournament/RegistrationStepReview";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-new.png";

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  registration_fee: number;
}

interface EventSettings {
  require_partner_account: boolean;
  max_events_per_player: number | null;
  require_emergency_contact: boolean;
}

interface Division {
  id: string;
  name: string;
  format: string;
  max_teams: number | null;
  description: string | null;
}

interface RegistrationFormData {
  divisionId: string;
  teamName: string;
  hasPartner: boolean;
  partnerId: string | null;
  shirtSizeCaptain: string;
  shirtSizePartner: string;
  emergencyContact: string;
  emergencyPhone: string;
  waiverAccepted: boolean;
}

const STEPS = [
  { id: 1, name: "Choose Division" },
  { id: 2, name: "Team Info" },
  { id: 3, name: "Additional Info" },
  { id: 4, name: "Review & Confirm" },
];

export default function TournamentRegister() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [event, setEvent] = useState<TournamentEvent | null>(null);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [eventSettings, setEventSettings] = useState<EventSettings | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationFormData>({
    divisionId: "",
    teamName: "",
    hasPartner: false,
    partnerId: null,
    shirtSizeCaptain: "M",
    shirtSizePartner: "M",
    emergencyContact: "",
    emergencyPhone: "",
    waiverAccepted: false,
  });

  useEffect(() => {
    checkAuthAndFetchEvent();
  }, [eventId]);

  const checkAuthAndFetchEvent = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please log in to register for tournaments",
        });
        navigate(`/auth?redirect=/tournament/${eventId}/register`);
        return;
      }

      await fetchEvent();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchEvent = async () => {
    const { data: eventData, error: eventError } = await supabase
      .from("tournaments_events")
      .select("*")
      .eq("id", eventId)
      .single();

    if (eventError) throw eventError;
    if (!eventData.registration_enabled) {
      throw new Error("Registration is not enabled for this tournament");
    }

    setEvent(eventData);

    // Fetch event settings
    const { data: settingsData } = await supabase
      .from("tournament_event_settings")
      .select("require_partner_account, max_events_per_player, require_emergency_contact")
      .eq("event_id", eventId)
      .single();

    const settings: EventSettings = {
      require_partner_account: settingsData?.require_partner_account ?? false,
      max_events_per_player: settingsData?.max_events_per_player ?? null,
      require_emergency_contact: settingsData?.require_emergency_contact ?? true,
    };

    setEventSettings(settings);

    // Check max events per player
    if (settings.max_events_per_player) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { count } = await supabase
          .from("tournament_registrations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eventId)
          .eq("captain_user_id", user.id)
          .in("status", ["confirmed", "pending"]);

        if ((count || 0) >= settings.max_events_per_player) {
          toast({
            title: "Registration limit reached",
            description: `You have already registered for the maximum of ${settings.max_events_per_player} events in this tournament`,
            variant: "destructive",
          });
          navigate(`/tournament/${eventId}`);
          return;
        }
      }
    }

    const { data: divisionsData, error: divisionsError } = await supabase
      .from("tournaments_divisions")
      .select("*")
      .eq("event_id", eventId);

    if (divisionsError) throw divisionsError;
    setDivisions(divisionsData || []);
  };

  const updateFormData = (updates: Partial<RegistrationFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.divisionId !== "";
      case 2:
        // If partner is required by event settings, enforce it
        if (eventSettings?.require_partner_account && !formData.partnerId) {
          return false;
        }
        return formData.teamName.trim() !== "" && 
               (formData.hasPartner ? formData.partnerId !== null : true);
      case 3:
        const requireEmergency = eventSettings?.require_emergency_contact !== false;
        if (requireEmergency) {
          return formData.emergencyContact.trim() !== "" && 
                 formData.emergencyPhone.trim() !== "" && 
                 formData.waiverAccepted;
        }
        return formData.waiverAccepted;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (canProceed() && currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Capture the full policy text from the review step
      const policyText = `
        ARRIVAL: Please arrive 15 minutes early for check-in. Warm-up begins 30 minutes before the first match.
        
        SPORTSMANSHIP: All players are expected to maintain respectful conduct. Unsportsmanlike behavior may result in disqualification.
        
        REFUND POLICY: Cancellations made more than 48 hours before the event receive a 50% refund. No refunds for cancellations within 48 hours of the event.
        
        WEATHER: In case of inclement weather, the tournament director will notify all registered teams via email.
      `.trim();

      const { data: registration, error: regError } = await supabase
        .from("tournament_registrations")
        .insert({
          event_id: eventId,
          division_id: formData.divisionId,
          team_name: formData.teamName,
          captain_user_id: user.id,
          partner_user_id: formData.partnerId,
          status: "pending",
          payment_status: "unpaid",
          additional_info: {
            shirt_sizes: {
              captain: formData.shirtSizeCaptain,
              partner: formData.shirtSizePartner,
            },
            emergency_contact: {
              name: formData.emergencyContact,
              phone: formData.emergencyPhone,
            },
            waiver_accepted: formData.waiverAccepted,
            policy_text: policyText,
            policy_accepted: true,
            policy_timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (regError) throw regError;

      // Send confirmation email (via edge function)
      await supabase.functions.invoke("send-registration-confirmation", {
        body: { registrationId: registration.id },
      });

      toast({
        title: "Registration submitted!",
        description: "You'll receive a confirmation email shortly.",
      });

      navigate(`/tournament/${eventId}`);
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Standard PULSE header for this page
  const StandardHeader = () => (
    <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
      <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
        <Link to={`/tournament/${eventId}`}>
          <img
            src={logo}
            alt="PULSE Logo"
            className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity"
          />
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/tournament/${eventId}`)}
            className="text-white hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    </nav>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader />
        <div className="container max-w-4xl py-8">
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading registration form...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background">
        <StandardHeader />
        <div className="container max-w-4xl py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">Tournament not found</p>
              <Button onClick={() => navigate("/tournaments")}>Browse Tournaments</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <StandardHeader />
      
      <div className="container max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Register for {event.name}</h1>
          <p className="text-muted-foreground">Complete the following steps to register your team</p>
        </div>

      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            {STEPS.map((step, idx) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    currentStep >= step.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {currentStep > step.id ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <span className="text-sm font-medium">{step.id}</span>
                  )}
                </div>
                <span
                  className={`ml-2 text-sm font-medium ${
                    currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.name}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className="w-12 h-0.5 mx-2 bg-muted" />
                )}
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </CardHeader>
        <CardContent className="min-h-[400px]">
          {currentStep === 1 && (
            <RegistrationStepDivision
              divisions={divisions}
              eventId={eventId!}
              selectedDivisionId={formData.divisionId}
              onSelectDivision={(divisionId) => updateFormData({ divisionId })}
              eventFee={event?.registration_fee}
              tournamentStartDate={event?.start_date}
            />
          )}
          {currentStep === 2 && (
            <RegistrationStepTeamInfo
              formData={formData}
              onUpdate={updateFormData}
            />
          )}
          {currentStep === 3 && (
            <RegistrationStepAdditionalInfo
              formData={formData}
              onUpdate={updateFormData}
            />
          )}
          {currentStep === 4 && (
            <RegistrationStepReview
              formData={formData}
              event={event}
              divisions={divisions}
            />
          )}
        </CardContent>
        <CardContent className="border-t pt-6">
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {currentStep < 4 ? (
              <Button onClick={handleNext} disabled={!canProceed()}>
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={!canProceed() || submitting}>
                {submitting ? "Submitting..." : "Submit Registration"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
