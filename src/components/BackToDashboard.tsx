import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackToDashboardProps {
  onNavigate?: () => boolean; // Return false to cancel navigation
  className?: string;
}

export function BackToDashboard({ onNavigate, className }: BackToDashboardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onNavigate && !onNavigate()) {
      return;
    }
    navigate("/dashboard");
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} className={className}>
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Dashboard
    </Button>
  );
}
