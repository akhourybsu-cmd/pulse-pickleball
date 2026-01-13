import { Mail, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ThankYouStepProps {
  email: string;
  venueName: string;
}

export function ThankYouStep({ email, venueName }: ThankYouStepProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      <div className="mb-8">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-2">We'll be in touch!</h2>
        <p className="text-lg text-muted-foreground max-w-md mx-auto">
          Thanks for your interest in Pulse. We'll send information about how we can help{" "}
          <span className="font-medium text-foreground">{venueName}</span> to{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      </div>

      <div className="bg-muted/50 rounded-lg p-6 max-w-md w-full mb-6">
        <div className="flex items-start gap-3 text-left">
          <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">What happens next?</p>
            <p className="text-sm text-muted-foreground">
              A member of our team will review your inquiry and reach out within 1-2 business days 
              with personalized information about how Pulse can benefit your venue.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 w-full max-w-xs">
        <Button
          variant="outline"
          onClick={() => navigate("/venues")}
          className="w-full"
        >
          Explore Pulse for Venues
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="w-full"
        >
          Return to Home
        </Button>
      </div>
    </div>
  );
}
