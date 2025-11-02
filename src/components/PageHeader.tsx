import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogOut, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/pulse-logo-new.png";

interface PageHeaderProps {
  userId?: string | null;
}

export function PageHeader({ userId }: PageHeaderProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="border-b bg-secondary">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/dashboard">
          <img 
            src={logo} 
            alt="PULSE Logo" 
            className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
          />
        </Link>
        <div className="flex items-center gap-3">
          {userId && (
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => navigate(`/profile/${userId}`)} 
              className="rounded-full"
            >
              <UserIcon className="h-[1.2rem] w-[1.2rem]" />
              <span className="sr-only">View Profile</span>
            </Button>
          )}
          <ThemeToggle />
          <Button variant="secondary" size="sm" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
}
