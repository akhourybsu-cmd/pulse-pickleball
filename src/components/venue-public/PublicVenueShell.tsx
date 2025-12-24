import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Home, Calendar, CalendarDays, Award, Info, Zap, ArrowLeft, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PublicVenue, VenueCourt, VenueEvent, VenueCoach } from '@/hooks/usePublicVenue';
import { supabase } from '@/integrations/supabase/client';
import pickleballPalaceLogo from '@/assets/pickleball-palace-logo.png';

export type TabId = 'home' | 'schedule' | 'events' | 'coaching' | 'info';

interface PublicVenueShellProps {
  venue: PublicVenue;
  courts: VenueCourt[];
  events: VenueEvent[];
  coaches: VenueCoach[];
  children: (activeTab: TabId, setActiveTab: (tab: TabId) => void) => React.ReactNode;
}

const tabs: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'schedule', label: 'Book Court', icon: Calendar },
  { id: 'events', label: 'Events', icon: CalendarDays },
  { id: 'coaching', label: 'Coaching', icon: Award },
  { id: 'info', label: 'Info', icon: Info },
];

// Helper to determine if a hex color is dark
function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

export function PublicVenueShell({ venue, courts, events, coaches, children }: PublicVenueShellProps) {
  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [isVenueAdmin, setIsVenueAdmin] = useState(false);
  const navigate = useNavigate();
  const primaryColor = venue.primary_color || '#FF6B35';
  const secondaryColor = venue.secondary_color || '#004E64';

  // Use the Pickleball Palace logo as fallback if no venue logo
  const logoSrc = venue.logo_url || pickleballPalaceLogo;

  // Check if current user is venue owner or staff
  useEffect(() => {
    const checkVenueAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check venue_staff for this venue
      const { data: staffData } = await supabase
        .from('venue_staff')
        .select('id')
        .eq('venue_id', venue.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (staffData) {
        setIsVenueAdmin(true);
      }
    };

    checkVenueAccess();
  }, [venue.id]);

  // Hide coaches tab if no coaches
  const visibleTabs = tabs.filter(tab => {
    if (tab.id === 'coaching' && coaches.length === 0) return false;
    return true;
  });

  // Determine if secondary color is dark (for header background)
  const isDarkSecondary = isColorDark(secondaryColor);
  // Use secondary as header background for a branded look
  const headerBg = secondaryColor;
  const headerTextColor = isDarkSecondary ? '#FFFFFF' : '#1A1A1A';

  return (
    <div 
      className="min-h-screen flex flex-col bg-background"
      style={{
        '--venue-primary': primaryColor,
        '--venue-secondary': secondaryColor,
      } as React.CSSProperties}
    >
      {/* Sticky Header with venue branding - uses secondary color as background */}
      <header 
        className="sticky top-0 z-50 border-b h-14"
        style={{
          backgroundColor: headerBg,
          borderColor: `${primaryColor}40`,
        }}
      >
        <div className="relative flex items-center justify-center h-full px-4">
          {/* Back button - styled for contrast on dark/light backgrounds */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(-1)}
            className="absolute left-2 h-9 w-9 hover:bg-white/10"
            style={{ color: headerTextColor }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          {/* Centered logo - takes up ~70-80% of header height */}
          <img 
            src={logoSrc} 
            alt={venue.name}
            className="h-10 max-w-[200px] object-contain"
          />
          
          {/* Admin toggle button for venue owners/staff */}
          {isVenueAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/venue')}
              className="absolute right-2 gap-1.5 h-8 text-xs border-current"
              style={{ 
                color: primaryColor, 
                borderColor: primaryColor,
                backgroundColor: 'transparent'
              }}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Admin</span>
            </Button>
          )}
        </div>
      </header>
      {/* Main Content */}
      <main className="flex-1 pb-20 md:pb-6">
        {children(activeTab, setActiveTab)}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border md:hidden safe-area-inset-bottom">
        <div className="flex justify-around items-center h-16">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex flex-col items-center justify-center flex-1 h-full transition-colors",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                style={isActive ? { color: primaryColor } : undefined}
              >
                <Icon className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Desktop Tab Navigation (horizontal) */}
      <nav className="hidden md:block fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center gap-2 h-14">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full transition-colors",
                    isActive 
                      ? "bg-primary/10 text-primary font-medium" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                  style={isActive ? { color: primaryColor, backgroundColor: `${primaryColor}15` } : undefined}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-sm">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Powered by Pulse (only on home tab) */}
      {activeTab === 'home' && venue.show_pulse_branding !== false && (
        <div className="fixed bottom-16 md:bottom-14 left-0 right-0 bg-background/95 border-t border-border py-2">
          <div className="text-center">
            <Link 
              to="/" 
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Zap className="w-3 h-3" />
              Powered by Pulse
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
