import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface DemoSignUpCTAProps {
  variant?: "card" | "inline";
}

export const DemoSignUpCTA = ({ variant = "card" }: DemoSignUpCTAProps) => {
  const navigate = useNavigate();

  if (variant === "inline") {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-6">
        <p className="text-muted-foreground text-sm">Ready to track your own stats?</p>
        <Button 
          onClick={() => navigate("/auth")}
          className="shadow-md"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Create Your Account
        </Button>
      </div>
    );
  }

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-xl sm:text-2xl">Ready to Start Your Journey?</CardTitle>
        <CardDescription className="text-base">
          Create your free account and start tracking your pickleball performance today.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-6">
        <Button 
          size="lg" 
          onClick={() => navigate("/auth")}
          className="shadow-lg hover:shadow-xl transition-shadow"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Create Your Account
        </Button>
      </CardContent>
    </Card>
  );
};
