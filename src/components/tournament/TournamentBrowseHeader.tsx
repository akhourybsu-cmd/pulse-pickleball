import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogIn, LayoutDashboard } from "lucide-react";
import logo from "@/assets/pulse-logo-premium.svg";

interface TournamentBrowseHeaderProps {
  userId?: string | null;
  activeTab?: 'browse' | 'manage';
}

export function TournamentBrowseHeader({ userId, activeTab = 'browse' }: TournamentBrowseHeaderProps) {
  const navigate = useNavigate();

  return (
    <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
      <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-4 flex items-center justify-between h-16 sm:h-[72px]">
        {/* Logo */}
        <Link to={userId ? "/player/dashboard" : "/"}>
          <img 
            src={logo} 
            alt="PULSE Logo" 
            className="h-[50px] sm:h-[60px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
          />
        </Link>

        {/* Navigation Tabs - Desktop */}
        <div className="hidden sm:flex items-center gap-1 bg-secondary-foreground/10 rounded-lg p-1">
          <Button
            variant={activeTab === 'browse' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => navigate('/tournaments/browse')}
            className={activeTab === 'browse' ? 'bg-background text-foreground shadow-sm' : 'text-white/80 hover:text-white hover:bg-secondary-foreground/10'}
          >
            Browse
          </Button>
          {userId && (
            <Button
              variant={activeTab === 'manage' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => navigate('/tournaments/manage')}
              className={activeTab === 'manage' ? 'bg-background text-foreground shadow-sm' : 'text-white/80 hover:text-white hover:bg-secondary-foreground/10'}
            >
              Manage
            </Button>
          )}
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          
          {userId ? (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate('/player/dashboard')}
              className="hidden sm:flex"
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          ) : (
            <Button 
              variant="default" 
              size="sm"
              onClick={() => navigate('/auth')}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Sign In
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
