import { CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ConfirmationStepProps {
  dynamicMessage: string;
}

export function ConfirmationStep({ dynamicMessage }: ConfirmationStepProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      <div className="mb-6">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Thanks — you're on your way.</h2>
        <p className="text-lg text-muted-foreground">{dynamicMessage}</p>
      </div>

      <div className="space-y-3 w-full max-w-xs">
        <Button
          onClick={() => navigate("/venues")}
          className="w-full"
          size="lg"
        >
          Explore Pulse for Venues
          <ArrowRight className="h-4 w-4 ml-2" />
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
