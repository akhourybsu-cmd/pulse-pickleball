import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BackToDashboardProps {
  onNavigate?: () => boolean; // Return false to cancel navigation
  className?: string;
  variant?: "default" | "light-on-dark";
  backTo?: string;
  label?: string;
}

export function BackToDashboard({ 
  onNavigate, 
  className, 
  variant = "default",
  backTo = "/player/dashboard",
  label = "Back to Dashboard"
}: BackToDashboardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onNavigate && !onNavigate()) {
      return;
    }
    navigate(backTo);
  };

  const variantStyles = {
    default: "text-foreground hover:text-foreground/80 hover:bg-muted",
    "light-on-dark": "text-white hover:text-white hover:bg-white/10"
  };

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      onClick={handleClick} 
      className={`${variantStyles[variant]} ${className}`}
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      {label}
    </Button>
  );
}
