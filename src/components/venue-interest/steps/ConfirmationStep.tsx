import { CheckCircle2, Sparkles, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ConfirmationStepProps {
  dynamicMessage: string;
  onCreateNow: () => void;
  onRequestInfo: () => void;
  isLoading?: boolean;
  loadingAction?: "create" | "info" | null;
}

export function ConfirmationStep({
  dynamicMessage,
  onCreateNow,
  onRequestInfo,
  isLoading = false,
  loadingAction = null,
}: ConfirmationStepProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-8">
      <div className="mb-8">
        <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-3xl font-bold mb-2">Thanks — you're on your way.</h2>
        <p className="text-lg text-muted-foreground">{dynamicMessage}</p>
      </div>

      <div className="space-y-4 w-full max-w-md">
        {/* Option 1: Create Free Profile Now */}
        <Card
          className={`p-6 cursor-pointer transition-all hover:border-primary hover:shadow-lg ${
            isLoading && loadingAction !== "create" ? "opacity-50 pointer-events-none" : ""
          }`}
          onClick={!isLoading ? onCreateNow : undefined}
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              {loadingAction === "create" ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <Sparkles className="h-6 w-6 text-primary" />
              )}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg mb-1">
                Create My Free Profile and Tour Pulse Today
              </h3>
              <p className="text-sm text-muted-foreground">
                Get started now — it only takes a minute to set up your venue and explore all the features.
              </p>
            </div>
          </div>
          <Button
            className="w-full mt-4"
            size="lg"
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation();
              onCreateNow();
            }}
          >
            {loadingAction === "create" ? "Setting up..." : "Get Started Now"}
          </Button>
        </Card>

        {/* Option 2: Request More Information */}
        <Card
          className={`p-6 cursor-pointer transition-all hover:border-muted-foreground/50 ${
            isLoading && loadingAction !== "info" ? "opacity-50 pointer-events-none" : ""
          }`}
          onClick={!isLoading ? onRequestInfo : undefined}
        >
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
              {loadingAction === "info" ? (
                <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
              ) : (
                <Mail className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="text-left">
              <h3 className="font-semibold text-lg mb-1">
                Send Me More Information About Pulse
              </h3>
              <p className="text-sm text-muted-foreground">
                We'll reach out with details about how Pulse can help your venue grow.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full mt-4"
            size="lg"
            disabled={isLoading}
            onClick={(e) => {
              e.stopPropagation();
              onRequestInfo();
            }}
          >
            {loadingAction === "info" ? "Sending..." : "Request Information"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
