import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, CheckCircle } from "lucide-react";
import { BackToDashboard } from "@/components/BackToDashboard";
import { RegistrationStepDivision } from "@/components/tournament/RegistrationStepDivision";
import { RegistrationStepTeamInfo } from "@/components/tournament/RegistrationStepTeamInfo";
import { RegistrationStepAdditionalInfo } from "@/components/tournament/RegistrationStepAdditionalInfo";
import { RegistrationStepReview } from "@/components/tournament/RegistrationStepReview";

interface TournamentEvent {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  start_date: string;
  end_date: string;
  registration_fee: number;
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
        return formData.teamName.trim() !== "" && 
               (formData.hasPartner ? formData.partnerId !== null : true);
      case 3:
        return formData.emergencyContact.trim() !== "" && 
               formData.emergencyPhone.trim() !== "" && 
               formData.waiverAccepted;
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

      navigate("/my-registrations");
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

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <BackToDashboard />
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading registration form...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="container max-w-4xl py-8">
        <BackToDashboard />
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">Tournament not found</p>
            <Button onClick={() => navigate("/tournaments")}>Browse Tournaments</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="container max-w-4xl py-8">
      <BackToDashboard />
      
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
  );
}
