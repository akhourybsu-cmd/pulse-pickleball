import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar, MapPin, Users, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TournamentEvent {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  registration_fee: number;
}

interface Division {
  id: string;
  name: string;
  format: string;
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

interface RegistrationStepReviewProps {
  formData: RegistrationFormData;
  event: TournamentEvent;
  divisions: Division[];
}

export function RegistrationStepReview({
  formData,
  event,
  divisions,
}: RegistrationStepReviewProps) {
  const [partnerName, setPartnerName] = useState<string | null>(null);
  const selectedDivision = divisions.find((d) => d.id === formData.divisionId);

  useEffect(() => {
    if (formData.partnerId) {
      fetchPartnerName();
    }
  }, [formData.partnerId]);

  const fetchPartnerName = async () => {
    if (!formData.partnerId) return;
    
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", formData.partnerId)
      .single();

    if (data) {
      setPartnerName(data.display_name);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Review Your Registration</h3>
        <p className="text-sm text-muted-foreground">
          Please review all details before submitting
        </p>
      </div>

      <div className="space-y-4">
        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Tournament Details</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>
                {format(new Date(event.start_date), "MMM d")} -{" "}
                {format(new Date(event.end_date), "MMM d, yyyy")}
              </span>
            </div>
            {event.location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{event.location}</span>
              </div>
            )}
            {event.registration_fee > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span>${event.registration_fee.toFixed(2)} per team</span>
                <Badge variant="secondary">Payment pending</Badge>
              </div>
            )}
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Division</h4>
          <div className="flex items-center gap-2">
            <span className="font-medium">{selectedDivision?.name}</span>
            <Badge variant="outline">{selectedDivision?.format}</Badge>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Team Information</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{formData.teamName}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Partner: </span>
              {formData.hasPartner ? (
                <span>{partnerName || "Loading..."}</span>
              ) : (
                <Badge variant="secondary">TBD (will be assigned)</Badge>
              )}
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-medium mb-3">Additional Details</h4>
          <div className="grid gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Shirt sizes: </span>
              <span>
                You: {formData.shirtSizeCaptain}
                {formData.hasPartner && ` • Partner: ${formData.shirtSizePartner}`}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Emergency contact: </span>
              <span>
                {formData.emergencyContact} • {formData.emergencyPhone}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="default">✓ Waiver accepted</Badge>
            </div>
          </div>
        </div>

        <div className="bg-muted/50 border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            After submitting, your registration will be marked as <strong>pending</strong>. 
            You'll receive a confirmation email and the tournament director will review and 
            approve your registration. You can track the status in "My Registrations".
          </p>
        </div>
      </div>
    </div>
  );
}
