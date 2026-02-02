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
    navigate("/player/dashboard");
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} className={`text-white hover:text-white hover:bg-white/10 ${className}`}>
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back to Dashboard
    </Button>
  );
}
